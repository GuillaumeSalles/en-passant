import {
  STORE_NAMES,
  MOVE_STORE_NAMES,
  type DatabaseSnapshot,
  type LocalDatabase,
  type DatabaseCommit,
  type DatabaseQuery,
  type DatabaseRecord,
  type MoveStoreName,
} from "./databaseContract";
import { indexPgnMoves, type MoveOccurrence } from "@/lib/moveIndex";
import type { StoredPgn } from "./contracts";
import type { StoredGame } from "@/lib/gameContracts";

export const LOCAL_DATABASE_NAME = "en-passant-local-v1";
// v4 adds independent move schedules without changing existing sources or occurrences.
export const LOCAL_DATABASE_VERSION = 4;
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

async function transact<T>(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  action: (transaction: IDBTransaction) => Promise<T>,
): Promise<T> {
  const tx = db.transaction([...new Set(stores)], mode);
  const done = completed(tx);
  try {
    const result = await action(tx);
    await done;
    return result;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // The transaction may already have aborted or completed.
    }
    await done.catch(() => undefined);
    throw error;
  }
}

function moveStore(store: string): MoveStoreName | null {
  return store === "pgns" ? "repertoire-moves" : store === "games" ? "game-moves" : null;
}

function sourceMoves(store: string, id: string, value: string): MoveOccurrence[] {
  if (store === "pgns") {
    const pgn = JSON.parse(value) as StoredPgn;
    return pgn.deletedAt == null ? indexPgnMoves(id, pgn.pgn, "tree") : [];
  }
  const game = JSON.parse(value) as StoredGame;
  return indexPgnMoves(id, game.pgn, "mainline");
}

function open(): Promise<IDBDatabase> {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const opening = indexedDB.open(LOCAL_DATABASE_NAME, LOCAL_DATABASE_VERSION);
    let upgradeError: unknown;
    let blocked = false;
    opening.onupgradeneeded = (event) => {
      const db = opening.result;
      const tx = opening.transaction;
      if (tx === null) return;
      for (const name of [...STORE_NAMES, "metadata"]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
      if (event.oldVersion >= 3) return;
      if (event.oldVersion >= 2) {
        // Existing occurrences remain byte-for-byte unchanged; no PGN rebuild is needed.
        tx.objectStore("chapters").deleteIndex("by-pgn");
        tx.objectStore("repertoire-moves").deleteIndex("by-position");
        for (const name of MOVE_STORE_NAMES) {
          const store = tx.objectStore(name);
          store.deleteIndex("by-position-move");
          store.deleteIndex("by-resulting-position");
        }
        return;
      }
      tx.objectStore("chapters").createIndex("by-repertoire", "repertoireId");
      for (const name of MOVE_STORE_NAMES) {
        const store = db.createObjectStore(name);
        store.createIndex("by-source", "sourceId");
        if (name === "game-moves") store.createIndex("by-position", "beforeKey");
      }
      // Only index the current local library. Never read account-linked stores or backups.
      // A parse or write failure aborts the upgrade, preserving the entire v1 database.
      for (const source of ["pgns", "games"] as const) {
        const cursor = tx.objectStore(source).openCursor();
        cursor.onsuccess = () => {
          const entry = cursor.result;
          if (entry === null) return;
          try {
            const target = moveStore(source);
            if (target === null) return;
            for (const move of sourceMoves(
              source,
              String(entry.key),
              JSON.stringify(entry.value),
            )) {
              tx.objectStore(target).put(move, move.id);
            }
            entry.continue();
          } catch (error) {
            upgradeError = new Error(
              `Could not index local ${source} record ${String(entry.key)}. Original data was preserved.`,
              { cause: error },
            );
            tx.abort();
          }
        };
      }
    };
    opening.onerror = () => reject(upgradeError ?? opening.error);
    opening.onblocked = () => {
      blocked = true;
      reject(new Error("Close other En Passant tabs and try again."));
    };
    opening.onsuccess = () => {
      const db = opening.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => {
        db.close();
        connection = undefined;
      };
      resolve(db);
    };
  }).catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
  return connection;
}

async function readQuery(tx: IDBTransaction, query: DatabaseQuery): Promise<DatabaseRecord[]> {
  const store = tx.objectStore(query.store);
  const source = query.index === undefined ? store : store.index(query.index);
  const [keys, values] = await Promise.all([
    request(source.getAllKeys(query.key)),
    request(source.getAll(query.key) as IDBRequest<unknown[]>),
  ]);
  return keys.map((id, index) => ({
    store: query.store,
    id: String(id),
    value: JSON.stringify(values[index]),
  }));
}

const browserDatabase: LocalDatabase = {
  async read(queries = STORE_NAMES.map((store) => ({ store }))) {
    const db = await open();
    return transact(db, [...queries.map((q) => q.store), "metadata"], "readonly", async (tx) => {
      const [version, groups] = await Promise.all([
        request(tx.objectStore("metadata").get("revision") as IDBRequest<number | undefined>),
        Promise.all(queries.map((query) => readQuery(tx, query))),
      ]);
      const unique = new Map(
        groups.flat().map((record) => [JSON.stringify([record.store, record.id]), record]),
      );
      return { version: version ?? 0, records: [...unique.values()] };
    });
  },
  async commit(change: DatabaseCommit) {
    // Prepare outside the transaction; a parsing failure cannot partially save a PGN.
    const replacements = change.put.flatMap((record) => {
      const target = moveStore(record.store);
      return target === null
        ? []
        : [{ target, id: record.id, moves: sourceMoves(record.store, record.id, record.value) }];
    });
    for (const record of change.remove) {
      const target = moveStore(record.store);
      if (target !== null) replacements.push({ target, id: record.id, moves: [] });
    }
    const db = await open();
    return transact(
      db,
      [
        "metadata",
        ...change.put.map((r) => r.store),
        ...change.remove.map((r) => r.store),
        ...replacements.map((r) => r.target),
      ],
      "readwrite",
      async (tx) => {
        const metadata = tx.objectStore("metadata");
        const version = await request(metadata.get("revision") as IDBRequest<number | undefined>);
        if ((version ?? 0) !== change.expectedVersion) return false;
        for (const record of change.put)
          tx.objectStore(record.store).put(JSON.parse(record.value), record.id);
        for (const record of change.remove) tx.objectStore(record.store).delete(record.id);
        for (const replacement of replacements) {
          const store = tx.objectStore(replacement.target);
          const keys = await request(store.index("by-source").getAllKeys(replacement.id));
          for (const key of keys) store.delete(key);
          for (const move of replacement.moves) store.put(move, move.id);
        }
        metadata.put((version ?? 0) + 1, "revision");
        return true;
      },
    );
  },
};

export function localDatabase(): LocalDatabase {
  return browserDatabase;
}

export async function updateDatabase(
  edit: (snapshot: DatabaseSnapshot) => DatabaseCommit,
  queries?: readonly DatabaseQuery[],
): Promise<void> {
  const database = localDatabase();
  for (let attempt = 0; attempt < 20; attempt++) {
    const snapshot = await database.read(queries);
    if (await database.commit(edit(snapshot))) return;
  }
  throw new Error("The library changed in another window. Please try again.");
}
