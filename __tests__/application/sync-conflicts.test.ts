import { createSyncEngine, type SyncEngineGateway, type SyncEngineStore } from '../../src/application/sync-engine';
import { resolveSyncConflict } from '../../src/application/sync-conflicts';
import type { SyncConflict, SyncOutboxMutation } from '../../src/data/sync-outbox';

const mutation: SyncOutboxMutation = {
  mutationId: '0ba9406a-9dfd-49ff-829b-7727e25b9b59', deviceId: '99b468e9-cfab-4b41-b53a-0690e5757f82',
  entityType: 'projects', entityId: 'da422d2c-a1ae-41e7-a252-f3529f567a77', operation: 'upsert',
  expectedVersion: 1, dataGeneration: 1, payload: { id: 'da422d2c-a1ae-41e7-a252-f3529f567a77', title: 'Локальная версия' }, createdAt: '2026-09-04T08:00:00.000Z',
};

describe('sync conflicts', () => {
  test('stores and acknowledges only a conflicting mutation while continuing with other mutations', async () => {
    const second = { ...mutation, mutationId: '2ba9406a-9dfd-49ff-829b-7727e25b9b59', entityId: 'ca422d2c-a1ae-41e7-a252-f3529f567a77' };
    const calls: string[] = [];
    const store: SyncEngineStore = {
      listSyncOutbox: async () => [mutation, second],
      acknowledgeSyncMutations: async (results) => { calls.push(`ack:${results.map((result) => result.mutationId).join(',')}`); },
      recordSyncConflicts: async (conflicts) => { calls.push(`conflict:${conflicts[0]?.local.mutationId}`); },
      getSyncCursor: async () => 0,
      applyRemoteSyncChanges: async () => {},
    };
    const gateway: SyncEngineGateway = {
      push: async () => ({
        mutations: [{ mutationId: second.mutationId, entityType: second.entityType, entityId: second.entityId, operation: second.operation, version: 2 }],
        conflicts: [{ local: mutation, server: { operation: 'upsert', version: 2, payload: { id: mutation.entityId, title: 'Версия с другого устройства' }, changedAt: '2026-09-04T08:01:00.000Z', deviceId: 'other-device' } }],
      }),
      pull: async () => [],
    };

    await expect(createSyncEngine({ gateway, store }).syncNow()).resolves.toEqual({ pushed: 1, pulled: 0 });

    expect(calls).toEqual([`conflict:${mutation.mutationId}`, `ack:${second.mutationId},${mutation.mutationId}`]);
  });

  test('keeps the local edit by creating a fresh mutation from the server version', async () => {
    const conflict: SyncConflict = {
      id: 'conflict-1', local: mutation,
      server: { operation: 'upsert', version: 2, payload: { id: mutation.entityId, title: 'Версия с другого устройства' }, changedAt: '2026-09-04T08:01:00.000Z', deviceId: 'other-device' },
      createdAt: '2026-09-04T08:02:00.000Z',
    };
    const calls: string[] = [];
    await resolveSyncConflict({
      getSyncCursor: async () => 4,
      enqueueSyncMutation: async (input) => { calls.push(`enqueue:${input.operation}:${input.entityId}`); return mutation; },
      applyRemoteSyncChanges: async () => { calls.push('remote'); },
      removeSyncConflict: async (id) => { calls.push(`remove:${id}`); },
    }, conflict, 'keep_local');

    expect(calls).toEqual([`enqueue:upsert:${mutation.entityId}`, 'remove:conflict-1']);
  });

  test('keeps a remote deletion by applying its version without creating another mutation', async () => {
    const conflict: SyncConflict = {
      id: 'conflict-2', local: mutation,
      server: { operation: 'delete', version: 2, payload: { id: mutation.entityId }, changedAt: '2026-09-04T08:01:00.000Z', deviceId: 'other-device' },
      createdAt: '2026-09-04T08:02:00.000Z',
    };
    const calls: string[] = [];
    await resolveSyncConflict({
      getSyncCursor: async () => 4,
      enqueueSyncMutation: async () => { calls.push('enqueue'); return mutation; },
      applyRemoteSyncChanges: async (changes, cursor) => { calls.push(`remote:${changes[0]?.operation}:${changes[0]?.version}:${cursor}`); },
      removeSyncConflict: async (id) => { calls.push(`remove:${id}`); },
    }, conflict, 'keep_remote');

    expect(calls).toEqual(['remote:delete:2:4', 'remove:conflict-2']);
  });
});
