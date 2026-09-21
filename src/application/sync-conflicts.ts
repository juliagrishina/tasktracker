import type { IncomingSyncConflict, RemoteSyncChange, SyncConflict, SyncOutboxMutation } from '../data/sync-outbox';

export type SyncConflictDecision = 'keep_local' | 'keep_remote';

export interface SyncConflictResolutionStore {
  getSyncCursor(): Promise<number>;
  enqueueSyncMutation(input: Omit<SyncOutboxMutation, 'mutationId' | 'deviceId' | 'expectedVersion' | 'dataGeneration' | 'createdAt'>): Promise<SyncOutboxMutation>;
  applyRemoteSyncChanges(changes: readonly RemoteSyncChange[], cursor: number): Promise<void>;
  removeSyncConflict(id: string): Promise<void>;
}

export async function resolveSyncConflict(
  store: SyncConflictResolutionStore,
  conflict: SyncConflict,
  decision: SyncConflictDecision,
): Promise<void> {
  if (decision === 'keep_local') {
    await store.enqueueSyncMutation({
      entityType: conflict.local.entityType,
      entityId: conflict.local.entityId,
      operation: conflict.local.operation,
      payload: conflict.local.payload,
    });
  } else {
    const cursor = await store.getSyncCursor();
    await store.applyRemoteSyncChanges([toRemoteChange(conflict)], cursor);
  }
  await store.removeSyncConflict(conflict.id);
}

export function createStoredSyncConflict(conflict: IncomingSyncConflict, id: string, createdAt: string): SyncConflict {
  return { ...conflict, id, createdAt };
}

function toRemoteChange(conflict: SyncConflict): RemoteSyncChange {
  return {
    changeCursor: 0,
    entityType: conflict.local.entityType,
    entityId: conflict.local.entityId,
    operation: conflict.server.operation,
    version: conflict.server.version,
    payload: conflict.server.payload,
  };
}
