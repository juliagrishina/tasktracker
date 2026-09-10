import {
  createPersistentBrowserDataSource,
  createDataSource,
  type BrowserDataSnapshot,
  type BrowserScopeStorage,
} from '../../src/data/data-source.web';
import { createIndexedDbBrowserSnapshotStore, type BrowserSnapshotRecord, type BrowserSnapshotStore } from '../../src/data/browser-indexeddb-storage';
import { databaseNameForScope, type LocalDataScope } from '../../src/data/local-data-scopes';
import type { SyncMetadataDataSource } from '../../src/data/sync-outbox';
import { IDBFactory } from 'fake-indexeddb';

class MemorySnapshotStore implements BrowserSnapshotStore<BrowserDataSnapshot> {
  private readonly values = new Map<string, BrowserSnapshotRecord<BrowserDataSnapshot>>();

  async read(scopeKey: string): Promise<BrowserSnapshotRecord<BrowserDataSnapshot> | null> {
    return this.values.get(scopeKey) ?? null;
  }

  async write(scopeKey: string, record: BrowserSnapshotRecord<BrowserDataSnapshot>): Promise<void> {
    this.values.set(scopeKey, record);
  }
}

class RejectingWriteSnapshotStore extends MemorySnapshotStore {
  writeAttempts = 0;

  override async write(): Promise<void> {
    this.writeAttempts += 1;
    throw new Error('IndexedDB is unavailable.');
  }
}

function createLegacyStorage(values = new Map<string, string>()): BrowserScopeStorage {
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

function legacyKey(scope: LocalDataScope): string {
  return `tasktracker.browser-data.${databaseNameForScope(scope)}.v1`;
}

const legacyProject = {
  id: 'legacy-project',
  title: 'Сохранённый проект',
  description: null,
  completedAt: null,
  createdAt: '2026-09-10T08:00:00.000Z',
  updatedAt: '2026-09-10T08:00:00.000Z',
  deletedAt: null,
};

describe('IndexedDB web snapshot migration', () => {
  test('copies a valid legacy account snapshot to IndexedDB and preserves its raw fallback', async () => {
    const scope = { kind: 'account' as const, accountId: 'account-migration' };
    const values = new Map<string, string>();
    const storage = createLegacyStorage(values);
    const rawLegacySnapshot = JSON.stringify({ projects: [legacyProject], taskItems: [] });
    values.set(legacyKey(scope), rawLegacySnapshot);
    const snapshotStore = new MemorySnapshotStore();

    const source = createPersistentBrowserDataSource(scope, { legacyStorage: storage, snapshotStore });
    await source.initialize();

    await expect(source.listProjects()).resolves.toMatchObject([{ title: 'Сохранённый проект' }]);
    await expect(snapshotStore.read(databaseNameForScope(scope))).resolves.toMatchObject({
      migratedFromLegacy: true,
      snapshot: { projects: [{ title: 'Сохранённый проект' }] },
    });
    expect(storage.getItem(legacyKey(scope))).toBe(rawLegacySnapshot);

    await source.saveProject({ ...legacyProject, id: 'post-migration-project', title: 'После миграции' });
    const persistedAfterMutation = await snapshotStore.read(databaseNameForScope(scope));
    expect(persistedAfterMutation?.migratedFromLegacy).toBe(true);
    expect(persistedAfterMutation?.snapshot.projects).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'После миграции' })]),
    );

    const reopened = createPersistentBrowserDataSource(scope, { legacyStorage: storage, snapshotStore });
    await expect(reopened.listProjects()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'Сохранённый проект' })]),
    );
  });

  test('leaves a corrupt legacy snapshot untouched and starts with an empty area', async () => {
    const scope = { kind: 'autonomous' as const };
    const values = new Map<string, string>();
    const storage = createLegacyStorage(values);
    const rawLegacySnapshot = '{not-json';
    values.set(legacyKey(scope), rawLegacySnapshot);
    const snapshotStore = new MemorySnapshotStore();

    const source = createPersistentBrowserDataSource(scope, { legacyStorage: storage, snapshotStore });
    await expect(source.listProjects()).resolves.toEqual([]);
    await expect(snapshotStore.read(databaseNameForScope(scope))).resolves.toBeNull();
    expect(storage.getItem(legacyKey(scope))).toBe(rawLegacySnapshot);
  });

  test('leaves a partial legacy snapshot untouched and starts with an empty area', async () => {
    const scope = { kind: 'autonomous' as const };
    const values = new Map<string, string>();
    const storage = createLegacyStorage(values);
    const rawLegacySnapshot = JSON.stringify({ projects: [legacyProject] });
    values.set(legacyKey(scope), rawLegacySnapshot);
    const snapshotStore = new MemorySnapshotStore();

    const source = createPersistentBrowserDataSource(scope, { legacyStorage: storage, snapshotStore });
    await expect(source.listProjects()).resolves.toEqual([]);
    await expect(snapshotStore.read(databaseNameForScope(scope))).resolves.toBeNull();
    expect(storage.getItem(legacyKey(scope))).toBe(rawLegacySnapshot);
  });

  test('rolls back an account mutation and its outbox command when persistence fails', async () => {
    const scope = { kind: 'account' as const, accountId: 'account-rollback' };
    const storage = createLegacyStorage();
    const snapshotStore = new RejectingWriteSnapshotStore();
    const source = createPersistentBrowserDataSource(scope, { legacyStorage: storage, snapshotStore });

    await expect(source.saveProject(legacyProject)).rejects.toThrow('IndexedDB is unavailable.');
    await expect(source.listProjects()).resolves.toEqual([]);
    await expect((source as typeof source & SyncMetadataDataSource).listSyncOutbox()).resolves.toEqual([]);
  });

  test('rolls back a failed transaction after one persistence attempt', async () => {
    const scope = { kind: 'account' as const, accountId: 'account-transaction-rollback' };
    const storage = createLegacyStorage();
    const snapshotStore = new RejectingWriteSnapshotStore();
    const source = createPersistentBrowserDataSource(scope, { legacyStorage: storage, snapshotStore });

    await expect(source.transaction(async () => {
      await source.saveProject(legacyProject);
      await source.saveProject({ ...legacyProject, id: 'second-project', title: 'Второй проект' });
    })).rejects.toThrow('IndexedDB is unavailable.');

    expect(snapshotStore.writeAttempts).toBe(1);
    await expect(source.listProjects()).resolves.toEqual([]);
    await expect((source as typeof source & SyncMetadataDataSource).listSyncOutbox()).resolves.toEqual([]);
  });

  test('reopens offline account data and its pending outbox from the same IndexedDB store', async () => {
    const scope = { kind: 'account' as const, accountId: 'account-offline-reopen' };
    const storage = createLegacyStorage();
    const snapshotStore = new MemorySnapshotStore();
    const source = createPersistentBrowserDataSource(scope, { legacyStorage: storage, snapshotStore });

    await source.saveProject(legacyProject);

    const reopened = createPersistentBrowserDataSource(scope, { legacyStorage: storage, snapshotStore });
    await expect(reopened.listProjects()).resolves.toMatchObject([{ title: 'Сохранённый проект' }]);
    await expect((reopened as typeof reopened & SyncMetadataDataSource).listSyncOutbox()).resolves.toMatchObject([
      { entityType: 'projects', operation: 'upsert' },
    ]);
  });

  test('keeps autonomous, Account A, and Account B snapshots isolated after reopen', async () => {
    const storage = createLegacyStorage();
    const snapshotStore = new MemorySnapshotStore();
    const autonomousScope = { kind: 'autonomous' as const };
    const accountAScope = { kind: 'account' as const, accountId: 'account-a' };
    const accountBScope = { kind: 'account' as const, accountId: 'account-b' };

    await createPersistentBrowserDataSource(autonomousScope, { legacyStorage: storage, snapshotStore })
      .saveProject({ ...legacyProject, id: 'autonomous-project', title: 'Автономный' });
    await createPersistentBrowserDataSource(accountAScope, { legacyStorage: storage, snapshotStore })
      .saveProject({ ...legacyProject, id: 'account-a-project', title: 'Аккаунт A' });
    await createPersistentBrowserDataSource(accountBScope, { legacyStorage: storage, snapshotStore })
      .saveProject({ ...legacyProject, id: 'account-b-project', title: 'Аккаунт B' });

    await expect(createPersistentBrowserDataSource(autonomousScope, { legacyStorage: storage, snapshotStore }).listProjects())
      .resolves.toMatchObject([{ title: 'Автономный' }]);
    await expect(createPersistentBrowserDataSource(accountAScope, { legacyStorage: storage, snapshotStore }).listProjects())
      .resolves.toMatchObject([{ title: 'Аккаунт A' }]);
    await expect(createPersistentBrowserDataSource(accountBScope, { legacyStorage: storage, snapshotStore }).listProjects())
      .resolves.toMatchObject([{ title: 'Аккаунт B' }]);
  });

  test('selects native IndexedDB for the production web factory when the browser API is available', async () => {
    const scope = { kind: 'account' as const, accountId: 'account-production-web' };
    const storage = createLegacyStorage();
    storage.setItem(legacyKey(scope), JSON.stringify({ projects: [legacyProject], taskItems: [] }));
    const factory = new IDBFactory();
    const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const indexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');

    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: factory });
    try {
      await expect(createDataSource(scope).listProjects()).resolves.toMatchObject([
        { title: 'Сохранённый проект' },
      ]);
      await expect(createIndexedDbBrowserSnapshotStore<BrowserDataSnapshot>(factory)
        .read(databaseNameForScope(scope))).resolves.toMatchObject({
        migratedFromLegacy: true,
        snapshot: { projects: [{ title: 'Сохранённый проект' }] },
      });
    } finally {
      if (localStorageDescriptor === undefined) Reflect.deleteProperty(globalThis, 'localStorage');
      else Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);
      if (indexedDbDescriptor === undefined) Reflect.deleteProperty(globalThis, 'indexedDB');
      else Object.defineProperty(globalThis, 'indexedDB', indexedDbDescriptor);
    }
  });
});
