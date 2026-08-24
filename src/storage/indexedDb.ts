function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function waitForTransaction<T>(
  transaction: IDBTransaction,
  requests: Promise<T>,
): Promise<T> {
  const done = transactionDone(transaction);
  try {
    const result = await requests;
    await done;
    return result;
  } catch (error) {
    await done.catch(() => undefined);
    throw error;
  }
}

export async function runTransaction<T>(
  database: IDBDatabase,
  storeNames: string | string[],
  mode: IDBTransactionMode,
  operation: (transaction: IDBTransaction) => T | Promise<T>,
): Promise<T> {
  const transaction = database.transaction(storeNames, mode);
  const done = transactionDone(transaction);

  try {
    const result = await operation(transaction);
    await done;
    return result;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // The transaction already completed or aborted.
    }
    await done.catch(() => undefined);
    throw error;
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export function getRecord<T>(store: IDBObjectStore, key: string): Promise<T | undefined> {
  return requestResult<T | undefined>(store.get(key));
}

export function getAllRecords<T>(store: IDBObjectStore): Promise<T[]> {
  return requestResult<T[]>(store.getAll());
}

export async function putRecord<T>(store: IDBObjectStore, key: string, value: T): Promise<void> {
  await requestResult(store.put(value, key));
}
