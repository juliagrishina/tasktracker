import { createAuthEntryState } from '../../src/data/auth-entry-state';

describe('Auth entry state', () => {
  test('requires an explicit autonomous choice before an anonymous session opens the app', async () => {
    const storage = createMemoryStorage();
    const entryState = createAuthEntryState(storage);

    await expect(entryState.shouldOpenApp({ kind: 'autonomous', userId: 'anonymous-id' })).resolves.toBe(false);

    await entryState.continueWithoutAccount();

    await expect(entryState.shouldOpenApp({ kind: 'autonomous', userId: 'anonymous-id' })).resolves.toBe(true);
  });

  test('always opens an authenticated account without an autonomous preference', async () => {
    const entryState = createAuthEntryState(createMemoryStorage());

    await expect(entryState.shouldOpenApp({ kind: 'authenticated', userId: 'account-id', email: 'anna@example.com' })).resolves.toBe(true);
  });
});

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
