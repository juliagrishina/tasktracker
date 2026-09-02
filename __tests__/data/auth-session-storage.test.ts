import {
  createNativeAuthSessionStorage,
  createWebAuthSessionStorage,
} from '../../src/data/auth-session-storage';

describe('Auth session storage', () => {
  test('uses the secure native storage adapter for every token operation', async () => {
    const secureStore = {
      getItemAsync: jest.fn().mockResolvedValue('serialized-session'),
      setItemAsync: jest.fn().mockResolvedValue(undefined),
      deleteItemAsync: jest.fn().mockResolvedValue(undefined),
    };
    const storage = createNativeAuthSessionStorage(secureStore);

    await expect(storage.getItem('supabase.session')).resolves.toBe('serialized-session');
    await storage.setItem('supabase.session', 'next-session');
    await storage.removeItem('supabase.session');

    expect(secureStore.getItemAsync).toHaveBeenCalledWith('supabase.session');
    expect(secureStore.setItemAsync).toHaveBeenCalledWith('supabase.session', 'next-session');
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('supabase.session');
  });

  test('uses browser storage on web without changing the serialized session', async () => {
    const values = new Map<string, string>();
    const webStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    const storage = createWebAuthSessionStorage(webStorage);

    await storage.setItem('supabase.session', 'serialized-session');
    await expect(storage.getItem('supabase.session')).resolves.toBe('serialized-session');
    await storage.removeItem('supabase.session');

    await expect(storage.getItem('supabase.session')).resolves.toBeNull();
  });
});
