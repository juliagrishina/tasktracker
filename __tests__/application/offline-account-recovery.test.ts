import { recoverOfflineAccountScope } from '../../src/application/offline-account-recovery';
import type { DataScopeRegistry } from '../../src/data/local-data-scopes';

describe('offline account recovery', () => {
  test('recovers only the persisted account scope', async () => {
    const recovered = await recoverOfflineAccountScope({
      getActiveScope: async () => ({ kind: 'account', accountId: 'user-17' }),
    } as DataScopeRegistry);

    expect(recovered).toEqual({ kind: 'account', accountId: 'user-17' });
  });

  test('does not recover an autonomous scope', async () => {
    await expect(recoverOfflineAccountScope({
      getActiveScope: async () => ({ kind: 'autonomous' }),
    } as DataScopeRegistry)).resolves.toBeNull();
  });
});
