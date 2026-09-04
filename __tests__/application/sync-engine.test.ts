import { createSyncEngine, type SyncEngineGateway, type SyncEngineStore } from '../../src/application/sync-engine';
import type { SyncOutboxMutation } from '../../src/data/sync-outbox';

const mutation: SyncOutboxMutation = {
  mutationId: '0ba9406a-9dfd-49ff-829b-7727e25b9b59',
  deviceId: '99b468e9-cfab-4b41-b53a-0690e5757f82',
  entityType: 'projects',
  entityId: 'da422d2c-a1ae-41e7-a252-f3529f567a77',
  operation: 'upsert',
  expectedVersion: 0,
  dataGeneration: 1,
  payload: { id: 'da422d2c-a1ae-41e7-a252-f3529f567a77', title: 'Переезд' },
  createdAt: '2026-09-04T08:00:00.000Z',
};

describe('sync engine', () => {
  test('acknowledges an outbox batch, applies pull, then advances the cursor', async () => {
    const calls: string[] = [];
    const store: SyncEngineStore = {
      listSyncOutbox: async () => [mutation],
      acknowledgeSyncMutations: async (results) => { calls.push(`ack:${results[0]?.mutationId}`); },
      getSyncCursor: async () => 8,
      applyRemoteSyncChanges: async (changes, cursor) => { calls.push(`apply:${changes[0]?.entityId}:${cursor}`); },
    };
    const gateway: SyncEngineGateway = {
      push: async (mutations) => {
        calls.push(`push:${mutations[0]?.mutationId}`);
        return [{ mutationId: mutation.mutationId, entityType: mutation.entityType, entityId: mutation.entityId, operation: mutation.operation, version: 1 }];
      },
      pull: async (cursor) => {
        calls.push(`pull:${cursor}`);
        return [{ changeCursor: 9, entityType: 'projects', entityId: mutation.entityId, operation: 'upsert', version: 1, payload: mutation.payload }];
      },
    };

    await createSyncEngine({ gateway, store }).syncNow();

    expect(calls).toEqual([
      `push:${mutation.mutationId}`,
      `ack:${mutation.mutationId}`,
      'pull:8',
      `apply:${mutation.entityId}:9`,
    ]);
  });

  test('keeps the cursor unchanged when applying a pulled batch fails and allows a retry', async () => {
    let attempts = 0;
    const cursors: number[] = [];
    const store: SyncEngineStore = {
      listSyncOutbox: async () => [],
      acknowledgeSyncMutations: async () => {},
      getSyncCursor: async () => 4,
      applyRemoteSyncChanges: async (_changes, cursor) => {
        cursors.push(cursor);
        attempts += 1;
        if (attempts === 1) throw new Error('local transaction failed');
      },
    };
    const gateway: SyncEngineGateway = {
      push: async () => [],
      pull: async () => [{ changeCursor: 5, entityType: 'projects', entityId: mutation.entityId, operation: 'upsert', version: 1, payload: mutation.payload }],
    };
    const engine = createSyncEngine({ gateway, store });

    await expect(engine.syncNow()).rejects.toThrow('local transaction failed');
    await expect(engine.syncNow()).resolves.toEqual({ pushed: 0, pulled: 1 });

    expect(cursors).toEqual([5, 5]);
  });

  test('coalesces overlapping requests into one network exchange', async () => {
    let resolvePull: ((changes: readonly []) => void) | undefined;
    const pullGate = new Promise<readonly []>((resolve) => { resolvePull = resolve; });
    const store: SyncEngineStore = {
      listSyncOutbox: async () => [],
      acknowledgeSyncMutations: async () => {},
      getSyncCursor: async () => 0,
      applyRemoteSyncChanges: async () => {},
    };
    const gateway: SyncEngineGateway = {
      push: async () => [],
      pull: jest.fn(() => pullGate),
    };
    const engine = createSyncEngine({ gateway, store });

    const first = engine.syncNow();
    await Promise.resolve();
    const second = engine.syncNow();
    resolvePull?.([]);

    await expect(Promise.all([first, second])).resolves.toEqual([{ pushed: 0, pulled: 0 }, { pushed: 0, pulled: 0 }]);
    expect(gateway.pull).toHaveBeenCalledTimes(1);
  });

  test('retries a failed exchange with a bounded delayed request', async () => {
    const scheduled: Array<() => void> = [];
    const store: SyncEngineStore = {
      listSyncOutbox: jest.fn(async () => [mutation]),
      acknowledgeSyncMutations: async () => {},
      getSyncCursor: async () => 0,
      applyRemoteSyncChanges: async () => {},
    };
    const gateway: SyncEngineGateway = {
      push: async () => { throw new Error('network unavailable'); },
      pull: async () => [],
    };
    const engine = createSyncEngine({
      gateway,
      store,
      setTimeoutFn: ((callback: () => void) => { scheduled.push(callback); return scheduled.length as unknown as ReturnType<typeof setTimeout>; }) as typeof setTimeout,
      clearTimeoutFn: jest.fn() as unknown as typeof clearTimeout,
    });

    await expect(engine.syncNow()).rejects.toThrow('network unavailable');
    expect(scheduled).toHaveLength(1);

    scheduled[0]?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(store.listSyncOutbox).toHaveBeenCalledTimes(2);
  });

  test('replaces a stale local replica with a full pull before retrying the exchange', async () => {
    let pushAttempts = 0;
    const resetForFullResync = jest.fn(async () => {});
    const store: SyncEngineStore & { resetForFullResync(dataGeneration: number): Promise<void> } = {
      listSyncOutbox: async () => [mutation],
      acknowledgeSyncMutations: async () => {},
      getSyncCursor: async () => 0,
      applyRemoteSyncChanges: async () => {},
      resetForFullResync,
    };
    const gateway: SyncEngineGateway & { getDataGeneration(): Promise<number> } = {
      push: async () => {
        pushAttempts += 1;
        if (pushAttempts === 1) throw Object.assign(new Error('stale generation'), { code: 'stale_generation' });
        return [{ mutationId: mutation.mutationId, entityType: mutation.entityType, entityId: mutation.entityId, operation: mutation.operation, version: 1 }];
      },
      pull: async () => [],
      getDataGeneration: async () => 2,
    };

    await expect(createSyncEngine({ gateway, store }).syncNow()).resolves.toEqual({ pushed: 1, pulled: 0 });

    expect(resetForFullResync).toHaveBeenCalledWith(2);
    expect(pushAttempts).toBe(2);
  });
});
