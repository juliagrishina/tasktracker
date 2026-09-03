jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
  })),
  processLock: jest.fn(),
}));

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-url-polyfill/auto', () => ({}));

jest.mock('../../src/data/auth-session-storage', () => ({
  authSessionStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

describe('Supabase Auth client session storage', () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  afterEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
    jest.resetModules();
  });

  test('uses the dedicated secure session adapter and only the publishable client key', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
    jest.resetModules();

    const { createClient } = jest.requireMock('@supabase/supabase-js') as {
      createClient: jest.Mock;
    };
    const { authSessionStorage } = jest.requireMock('../../src/data/auth-session-storage') as {
      authSessionStorage: unknown;
    };

    jest.requireActual('../../src/data/supabase-client');

    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'publishable-key',
      expect.objectContaining({
        auth: expect.objectContaining({ storage: authSessionStorage }),
      }),
    );
  });

  test('creates a transient password-verification client without persistent storage', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
    jest.resetModules();

    const { createClient } = jest.requireMock('@supabase/supabase-js') as { createClient: jest.Mock };
    const { createTransientSupabaseAuthClient } = jest.requireActual('../../src/data/supabase-client') as typeof import('../../src/data/supabase-client');

    createTransientSupabaseAuthClient();

    expect(createClient).toHaveBeenLastCalledWith(
      'https://example.supabase.co',
      'publishable-key',
      expect.objectContaining({
        auth: expect.objectContaining({ autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }),
      }),
    );
  });
});
