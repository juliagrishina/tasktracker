import { createSyncEngine, type SyncEngineGateway, type SyncEngineStore } from '../../src/application/sync-engine';
import type { SyncOutboxMutation } from '../../src/data/sync-outbox';

const mutation: SyncOutboxMutation = {
  mutationId: '0ba9406a-9dfd-49ff-829b-7727e25b9b59', deviceId: '99b468e9-cfab-4b41-b53a-0690e5757f82',
  entityType: 'projects', entityId: 'da422d2c-a1ae-41e7-a252-f3529f567a77', operation: 'upsert', expectedVersion: 0, dataGeneration: 1,
  payload: { id: 'da422d2c-a1ae-41e7-a252-f3529f567a77', title: 'Переезд' }, createdAt: '2026-09-04T08:00:00.000Z',
};

describe('sync status', () => {
  test('reports the syncing and successful states without exposing transport errors', async () => {
    const states: string[] = [];
    const store: SyncEngineStore = {
      listSyncOutbox: async () => [mutation], acknowledgeSyncMutations: async () => {}, getSyncCursor: async () => 0, applyRemoteSyncChanges: async () => {},
      recordSyncSuccess: async (at) => { states.push(`saved:${at}`); },
    };
    const gateway: SyncEngineGateway = { push: async () => [{ mutationId: mutation.mutationId, entityType: mutation.entityType, entityId: mutation.entityId, operation: mutation.operation, version: 1 }], pull: async () => [] };

    await createSyncEngine({ gateway, store, now: () => new Date('2026-09-04T10:00:00.000Z'), onStateChange: (state) => states.push(state.kind) }).syncNow();

    expect(states).toEqual(['syncing', 'saved:2026-09-04T10:00:00.000Z', 'synchronized']);
  });

  test('classifies an offline failure separately from a retryable failure', async () => {
    const store: SyncEngineStore = { listSyncOutbox: async () => [mutation], acknowledgeSyncMutations: async () => {}, getSyncCursor: async () => 0, applyRemoteSyncChanges: async () => {} };
    const gateway: SyncEngineGateway = { push: async () => { throw new Error('network unavailable'); }, pull: async () => [] };
    const states: string[] = [];
    const engine = createSyncEngine({ gateway, store, isOnline: () => false, onStateChange: (state) => states.push(state.kind) });

    await expect(engine.syncNow()).rejects.toThrow('network unavailable');

    expect(states).toEqual(['syncing', 'offline']);
    engine.dispose();
  });
});
