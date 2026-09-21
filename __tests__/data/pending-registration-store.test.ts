import { createPendingRegistrationStore } from '../../src/data/pending-registration-store';

describe('pending registration store', () => {
  test('persists verification metadata but never receives a password field', async () => {
    const values = new Map<string, string>();
    const store = createPendingRegistrationStore({
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        values.set(key, value);
      },
    });

    await store.save({
      userId: 'anon-user-17',
      displayName: 'Мария Иванова',
      email: 'maria@example.com',
      issuedAtMs: 1_000,
      resendAvailableAtMs: 61_000,
      failedAttempts: 0,
      invalidated: false,
    });

    const serialized = [...values.values()].join('');
    expect(serialized).not.toContain('P@ssword2026');
    await expect(store.load()).resolves.toEqual({
      userId: 'anon-user-17',
      displayName: 'Мария Иванова',
      email: 'maria@example.com',
      issuedAtMs: 1_000,
      resendAvailableAtMs: 61_000,
      failedAttempts: 0,
      invalidated: false,
    });
  });
});
