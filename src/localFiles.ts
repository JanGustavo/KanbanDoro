export type LocalFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  addedAt: number;
};

export const MAX_LOCAL_FILE_BYTES = 10 * 1024 * 1024;
const DB_NAME = 'kanbandoro-local-files';
const STORE = 'files';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = operation(transaction.objectStore(STORE));
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function saveLocalFile(file: File): Promise<LocalFile> {
  if (!file.size || file.size > MAX_LOCAL_FILE_BYTES) throw Error('Escolha um arquivo de até 10 MB.');
  const metadata = {
    id: crypto.randomUUID(),
    name: file.name.slice(0, 180),
    type: file.type.slice(0, 100),
    size: file.size,
    addedAt: Date.now(),
  };
  await transact('readwrite', store => store.put(file, metadata.id));
  return metadata;
}

export async function getLocalFile(id: string): Promise<Blob | undefined> {
  const stored = await transact<Blob | { blob: Blob; pendingAt: number } | undefined>('readonly', store =>
    store.get(id),
  );
  return stored instanceof Blob ? stored : stored?.blob;
}

export function deleteLocalFile(id: string): Promise<undefined> {
  return transact('readwrite', store => store.delete(id));
}

export async function pruneLocalFiles(referenced: Set<string>): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const cursor = transaction.objectStore(STORE).openCursor();
    cursor.onsuccess = () => {
      const item = cursor.result;
      if (item) {
        if (!referenced.has(String(item.key)) && !(item.value?.pendingAt > Date.now() - 5 * 60_000)) item.delete();
        item.continue();
      }
    };
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

/** Write a batch in one IndexedDB transaction; new IDs never overwrite existing files. */
export async function stageLocalFiles(files: Array<{ id: string; blob: Blob }>): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    for (const file of files) store.add({ blob: file.blob, pendingAt: Date.now() }, file.id);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function finishLocalFiles(ids: string[], commit: boolean): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    for (const id of ids) {
      if (!commit) store.delete(id);
      else {
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result?.blob) store.put(request.result.blob, id);
        };
      }
    }
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}
