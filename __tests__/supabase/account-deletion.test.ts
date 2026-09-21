import { executeAccountDeletion, type AccountDeletionStore } from '../../supabase/functions/_shared/account-deletion';

describe('durable account deletion', () => {
  test('keeps deletion pending after an Auth failure and safely completes a later retry', async () => {
    let deleteAuthAttempt = 0;
    const store: jest.Mocked<AccountDeletionStore> = {
      begin: jest.fn().mockResolvedValue(true),
      clearBusinessData: jest.fn().mockResolvedValue(true),
      deleteAuthUser: jest.fn().mockImplementation(async () => { deleteAuthAttempt += 1; return deleteAuthAttempt === 2; }),
      markRetry: jest.fn().mockResolvedValue(undefined),
      markCompleted: jest.fn().mockResolvedValue(true),
    };

    await expect(executeAccountDeletion(store, 'account-17')).resolves.toEqual({ kind: 'pending', reason: 'auth_delete_failed' });
    expect(store.markRetry).toHaveBeenCalledWith('account-17', 'auth_delete_failed');

    await expect(executeAccountDeletion(store, 'account-17')).resolves.toEqual({ kind: 'deleted' });
    expect(store.clearBusinessData).toHaveBeenCalledTimes(2);
    expect(store.markCompleted).toHaveBeenCalledWith('account-17');
  });
});
