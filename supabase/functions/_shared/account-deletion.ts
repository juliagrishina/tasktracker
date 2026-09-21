export type AccountDeletionResult =
  | { kind: 'deleted' }
  | { kind: 'pending'; reason: 'data_cleanup_failed' | 'auth_delete_failed' | 'completion_record_failed' };

type PendingDeletionReason = Extract<AccountDeletionResult, { kind: 'pending' }>['reason'];

export interface AccountDeletionStore {
  begin(userId: string): Promise<boolean>;
  clearBusinessData(userId: string): Promise<boolean>;
  deleteAuthUser(userId: string): Promise<boolean>;
  markRetry(userId: string, reason: PendingDeletionReason): Promise<void>;
  markCompleted(userId: string): Promise<boolean>;
}

/**
 * The operation can be run again after any transient failure. Once `begin`
 * succeeds, callers must no longer expose a working local account: the RLS
 * gate remains closed until Auth deletion completes.
 */
export async function executeAccountDeletion(store: AccountDeletionStore, userId: string): Promise<AccountDeletionResult> {
  if (!await store.begin(userId)) return { kind: 'pending', reason: 'data_cleanup_failed' };
  if (!await store.clearBusinessData(userId)) {
    await store.markRetry(userId, 'data_cleanup_failed');
    return { kind: 'pending', reason: 'data_cleanup_failed' };
  }
  if (!await store.deleteAuthUser(userId)) {
    await store.markRetry(userId, 'auth_delete_failed');
    return { kind: 'pending', reason: 'auth_delete_failed' };
  }
  if (!await store.markCompleted(userId)) {
    return { kind: 'pending', reason: 'completion_record_failed' };
  }
  return { kind: 'deleted' };
}
