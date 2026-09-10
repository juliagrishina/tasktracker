import { IDBFactory } from 'fake-indexeddb';

import {
  createIndexedDbBrowserSnapshotStore,
  type BrowserSnapshotRecord,
} from '../../src/data/browser-indexeddb-storage';

interface Snapshot {
  title: string;
}

const record = (title: string): BrowserSnapshotRecord<Snapshot> => ({
  schemaVersion: 1,
  migratedFromLegacy: false,
  snapshot: { title },
});

describe('IndexedDB browser snapshot store', () => {
  test('keeps snapshots from two scopes independently', async () => {
    const store = createIndexedDbBrowserSnapshotStore<Snapshot>(new IDBFactory());

    await store.write('tasktracker-account-a.db', record('Account A'));
    await store.write('tasktracker-account-b.db', record('Account B'));

    await expect(store.read('tasktracker-account-a.db')).resolves.toEqual(record('Account A'));
    await expect(store.read('tasktracker-account-b.db')).resolves.toEqual(record('Account B'));
    await expect(store.read('tasktracker-autonomous.db')).resolves.toBeNull();
  });

  test('rejects a write that IndexedDB cannot clone', async () => {
    const store = createIndexedDbBrowserSnapshotStore<Snapshot>(new IDBFactory());
    const unclonableRecord = {
      schemaVersion: 1,
      migratedFromLegacy: false,
      snapshot: { title: () => 'not serializable' },
    } as unknown as BrowserSnapshotRecord<Snapshot>;

    await expect(store.write('tasktracker-account-a.db', unclonableRecord)).rejects.toBeDefined();
    await expect(store.read('tasktracker-account-a.db')).resolves.toBeNull();
  });
});
