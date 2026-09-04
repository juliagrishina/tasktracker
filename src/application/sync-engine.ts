import type { IncomingSyncConflict, RemoteSyncChange, SyncMutationResult, SyncOutboxMutation, SyncPushResponse } from '../data/sync-outbox';

export type { IncomingSyncConflict, RemoteSyncChange, SyncMutationResult, SyncPushResponse } from '../data/sync-outbox';

export interface SyncEngineStore {
  listSyncOutbox(): Promise<readonly SyncOutboxMutation[]>;
  acknowledgeSyncMutations(results: readonly SyncMutationResult[]): Promise<void>;
  getSyncCursor(): Promise<number>;
  applyRemoteSyncChanges(changes: readonly RemoteSyncChange[], cursor: number): Promise<void>;
  resetForFullResync?(dataGeneration: number): Promise<void>;
  recordSyncConflicts?(conflicts: readonly IncomingSyncConflict[]): Promise<unknown>;
}

export interface SyncEngineGateway {
  push(mutations: readonly SyncOutboxMutation[]): Promise<readonly SyncMutationResult[] | SyncPushResponse>;
  pull(cursor: number, limit: number): Promise<readonly RemoteSyncChange[]>;
  getDataGeneration?(): Promise<number>;
}

export interface SyncEngine {
  syncNow(): Promise<{ pushed: number; pulled: number }>;
  notifyLocalMutation(): void;
  onForeground(): void;
  onNetworkReconnect(): void;
  onRealtimeSignal(): void;
  dispose(): void;
}

const defaultBatchSize = 100;
const defaultDebounceMs = 500;
const defaultRetryDelayMs = 1_000;
const maximumRetryDelayMs = 30_000;

export function createSyncEngine({
  gateway,
  store,
  batchSize = defaultBatchSize,
  debounceMs = defaultDebounceMs,
  retryDelayMs = defaultRetryDelayMs,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}: {
  gateway: SyncEngineGateway;
  store: SyncEngineStore;
  batchSize?: number;
  debounceMs?: number;
  retryDelayMs?: number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}): SyncEngine {
  let running: Promise<{ pushed: number; pulled: number }> | null = null;
  let delayed: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let retryAttempt = 0;

  const syncNow = (): Promise<{ pushed: number; pulled: number }> => {
    if (running !== null) return running;
    running = synchronizeWithRecovery()
      .then((result) => {
        retryAttempt = 0;
        return result;
      })
      .catch((error: unknown) => {
        scheduleRetry();
        throw error;
      })
      .finally(() => { running = null; });
    return running;
  };

  const schedule = (delay: number): void => {
    if (disposed) return;
    if (delayed !== null) clearTimeoutFn(delayed);
    delayed = setTimeoutFn(() => {
      delayed = null;
      void syncNow().catch(() => {});
    }, delay);
  };

  const scheduleRetry = (): void => {
    const delay = Math.min(retryDelayMs * 2 ** retryAttempt, maximumRetryDelayMs);
    retryAttempt += 1;
    schedule(delay);
  };

  const requestDebounced = (): void => {
    schedule(debounceMs);
  };

  const synchronize = async (): Promise<{ pushed: number; pulled: number }> => {
    let pushed = 0;
    const outbox = await store.listSyncOutbox();
    for (let offset = 0; offset < outbox.length; offset += batchSize) {
      const batch = outbox.slice(offset, offset + batchSize);
      const response = normalizePushResponse(await gateway.push(batch));
      const acknowledged = [...response.mutations, ...response.conflicts.map((conflict) => ({
        mutationId: conflict.local.mutationId,
        entityType: conflict.local.entityType,
        entityId: conflict.local.entityId,
        operation: conflict.local.operation,
        version: conflict.server.version,
      }))];
      if (acknowledged.length !== batch.length) throw new Error('Sync server did not acknowledge the complete mutation batch.');
      if (response.conflicts.length > 0) {
        if (store.recordSyncConflicts === undefined) throw new Error('Sync conflict storage is unavailable.');
        await store.recordSyncConflicts(response.conflicts);
      }
      await store.acknowledgeSyncMutations(acknowledged);
      pushed += response.mutations.length;
    }

    let pulled = 0;
    let cursor = await store.getSyncCursor();
    for (;;) {
      const changes = await gateway.pull(cursor, batchSize);
      if (changes.length === 0) break;
      const nextCursor = changes.at(-1)?.changeCursor;
      if (nextCursor === undefined || nextCursor <= cursor) throw new Error('Sync server returned an invalid cursor.');
      await store.applyRemoteSyncChanges(changes, nextCursor);
      cursor = nextCursor;
      pulled += changes.length;
      if (changes.length < batchSize) break;
    }
    return { pushed, pulled };
  };

  const synchronizeWithRecovery = async (): Promise<{ pushed: number; pulled: number }> => {
    try {
      return await synchronize();
    } catch (error) {
      if (!isStaleGenerationError(error) || store.resetForFullResync === undefined || gateway.getDataGeneration === undefined) {
        throw error;
      }
      await store.resetForFullResync(await gateway.getDataGeneration());
      return synchronize();
    }
  };

  return {
    syncNow,
    notifyLocalMutation: requestDebounced,
    onForeground: requestDebounced,
    onNetworkReconnect: requestDebounced,
    onRealtimeSignal: requestDebounced,
    dispose: () => {
      disposed = true;
      if (delayed !== null) clearTimeoutFn(delayed);
      delayed = null;
    },
  };
}

function normalizePushResponse(response: readonly SyncMutationResult[] | SyncPushResponse): SyncPushResponse {
  return 'mutations' in response ? response : { mutations: response, conflicts: [] };
}

function isStaleGenerationError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'stale_generation';
}
