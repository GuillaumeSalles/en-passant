import {
  STORE_NAMES,
  type DatabaseSnapshot,
  type LocalDatabase,
  type DatabaseCommit,
} from "./databaseContract";

export const LOCAL_DATABASE_NAME = "en-passant-local-v1";
let connection: Promise<IDBDatabase> | undefined;

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error ?? new Error("Local storage request failed"));
  });
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("Local save failed"));
    transaction.onerror = () => reject(transaction.error ?? new Error("Local save failed"));
  });
}

function open(): Promise<IDBDatabase> {
  connection ??= new Promise((resolve, reject) => {
    const opening = indexedDB.open(LOCAL_DATABASE_NAME, 1);
    opening.onupgradeneeded = () => {
      for (const name of [...STORE_NAMES, "metadata"]) opening.result.createObjectStore(name);
    };
    opening.onerror = () => reject(opening.error);
    opening.onblocked = () => reject(new Error("Close other En Passant tabs and try again."));
    opening.onsuccess = () => {
      const db = opening.result;
      db.onversionchange = () => {
        db.close();
        connection = undefined;
      };
      resolve(db);
    };
  });
  return connection;
}

const browserDatabase: LocalDatabase = {
  async read() {
    const db = await open();
    const tx = db.transaction([...STORE_NAMES, "metadata"], "readonly");
    const done = completed(tx);
    const [version, groups] = await Promise.all([
      request(tx.objectStore("metadata").get("revision") as IDBRequest<number | undefined>),
      Promise.all(
        STORE_NAMES.map(async (store) => {
          const objectStore = tx.objectStore(store);
          const [keys, values] = await Promise.all([
            request(objectStore.getAllKeys()),
            request(objectStore.getAll() as IDBRequest<unknown[]>),
          ]);
          return keys.map((id, index) => ({
            store,
            id: String(id),
            value: JSON.stringify(values[index]),
          }));
        }),
      ),
    ]);
    await done;
    return { version: version ?? 0, records: groups.flat() };
  },
  async commit(change: DatabaseCommit) {
    const db = await open();
    const tx = db.transaction([...STORE_NAMES, "metadata"], "readwrite");
    const done = completed(tx);
    const metadata = tx.objectStore("metadata");
    const version = await request(metadata.get("revision") as IDBRequest<number | undefined>);
    if ((version ?? 0) !== change.expectedVersion) {
      await done;
      return false;
    }
    for (const record of change.put)
      tx.objectStore(record.store).put(JSON.parse(record.value), record.id);
    for (const record of change.remove) tx.objectStore(record.store).delete(record.id);
    metadata.put((version ?? 0) + 1, "revision");
    await done;
    return true;
  },
};

export function localDatabase(): LocalDatabase {
  return browserDatabase;
}

export async function updateDatabase(
  edit: (snapshot: DatabaseSnapshot) => DatabaseCommit,
): Promise<void> {
  const database = localDatabase();
  for (let attempt = 0; attempt < 20; attempt++) {
    const snapshot = await database.read();
    if (await database.commit(edit(snapshot))) return;
  }
  throw new Error("The library changed in another window. Please try again.");
}
