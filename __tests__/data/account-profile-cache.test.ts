import type { AccountProfile } from '../../src/application/account-profile';
import { createAccountProfileCache } from '../../src/data/account-profile-cache';

describe('account profile cache', () => {
  test('keeps a profile copy scoped to its authenticated user', async () => {
    const storage = createMemoryStorage();
    const first = createAccountProfileCache({ storage, userId: 'user-17' });
    const other = createAccountProfileCache({ storage, userId: 'user-18' });
    const profile: AccountProfile = {
      userId: 'user-17',
      displayName: 'Мария Иванова',
      email: 'maria@example.com',
      emailConfirmed: true,
      pendingEmail: null,
    };

    await first.save(profile);

    await expect(first.load()).resolves.toEqual(profile);
    await expect(other.load()).resolves.toBeNull();
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
