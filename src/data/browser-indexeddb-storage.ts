const databaseName = 'tasktracker.web-replica.v1';
const objectStoreName = 'scopeSnapshots';

export interface BrowserSnapshotRecord<TSnapshot> {
  schemaVersion: 1;
  migratedFromLegacy: boolean;
  snapshot: TSnapshot;
}

export interface BrowserSnapshotStore<TSnapshot> {
  read(scopeKey: string): Promise<BrowserSnapshotRecord<TSnapshot> | null>;
  write(scopeKey: string, record: BrowserSnapshotRecord<TSnapshot>): Promise<void>;
}

export interface IndexedDbFactory {
  open(name: string, version?: number): IDBOpenDBRequest;
}

interface StoredSnapshot<TSnapshot> extends BrowserSnapshotRecord<TSnapshot> {
  scopeKey: string;
}

export function createIndexedDbBrowserSnapshotStore<TSnapshot>(
  indexedDb: IndexedDbFactory,
): BrowserSnapshotStore<TSnapshot> {
  let database: Promise<IDBDatabase> | null = null;

  const openDatabase = (): Promise<IDBDatabase> => {
    if (database !== null) return database;

    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDb.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(objectStoreName)) {
          request.result.createObjectStore(objectStoreName, { keyPath: 'scopeKey' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB.'));
      request.onblocked = () => reject(new Error('IndexedDB open is blocked.'));
    });

    return database;
  };

  return {
    read: async (scopeKey) => {
      const db = await openDatabase();
      return new Promise<BrowserSnapshotRecord<TSnapshot> | null>((resolve, reject) => {
        const transaction = db.transaction(objectStoreName, 'readonly');
        const request = transaction.objectStore(objectStoreName).get(scopeKey);
        request.onsuccess = () => {
          const stored = request.result as StoredSnapshot<TSnapshot> | undefined;
          if (stored === undefined) {
            resolve(null);
            return;
          }

          resolve({
            schemaVersion: stored.schemaVersion,
            migratedFromLegacy: stored.migratedFromLegacy,
            snapshot: stored.snapshot,
          });
        };
        request.onerror = () => reject(request.error ?? new Error('Could not read IndexedDB snapshot.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB read was aborted.'));
      });
    },
    write: async (scopeKey, record) => {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(objectStoreName, 'readwrite');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not write IndexedDB snapshot.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB write was aborted.'));

        try {
          transaction.objectStore(objectStoreName).put({ ...record, scopeKey } satisfies StoredSnapshot<TSnapshot>);
        } catch (error) {
          try {
            transaction.abort();
          } catch {
            // The transaction may already be inactive after the failed request.
          }
          reject(error);
        }
      });
    },
  };
}
