jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-secure-store', () => ({}));

describe('web Auth session storage bootstrap', () => {
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  afterEach(() => {
    if (originalLocalStorage === undefined) {
      Reflect.deleteProperty(globalThis, 'localStorage');
    } else {
      Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
    }
    jest.resetModules();
  });

  test('keeps the Auth bootstrap available when server rendering has no browser storage', async () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
    jest.resetModules();

    const { authSessionStorage } = jest.requireActual('../../src/data/auth-session-storage') as typeof import('../../src/data/auth-session-storage');

    await authSessionStorage.setItem('supabase.session', 'serialized-session');
    await expect(authSessionStorage.getItem('supabase.session')).resolves.toBe('serialized-session');
  });
});
