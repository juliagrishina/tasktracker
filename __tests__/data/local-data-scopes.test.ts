import {
  createDataScopeRegistry,
  databaseNameForScope,
} from '../../src/data/local-data-scopes';

function createMemoryStorage(): {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
} {
  const values = new Map<string, string>();
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
}

describe('local data scopes', () => {
  test('keeps an account area hidden after exit without deleting it', async () => {
    const registry = createDataScopeRegistry(createMemoryStorage());

    await expect(registry.getActiveScope()).resolves.toEqual({ kind: 'autonomous' });

    await registry.openAccountScope('account-a');
    await expect(registry.getActiveScope()).resolves.toEqual({
      kind: 'account',
      accountId: 'account-a',
    });

    await registry.hideAccountScope('account-a');
    await expect(registry.getActiveScope()).resolves.toEqual({ kind: 'autonomous' });

    await registry.openAccountScope('account-a');
    await expect(registry.listKnownAccountIds()).resolves.toEqual(['account-a']);
  });

  test('assigns a distinct SQLite database name to every local area', () => {
    expect(databaseNameForScope({ kind: 'autonomous' })).toBe('tasktracker-autonomous.db');
    expect(databaseNameForScope({ kind: 'account', accountId: 'account-a' })).toBe(
      'tasktracker-account-account-a.db',
    );
    expect(databaseNameForScope({ kind: 'account', accountId: 'account-b' })).not.toBe(
      databaseNameForScope({ kind: 'account', accountId: 'account-a' }),
    );
  });
});
