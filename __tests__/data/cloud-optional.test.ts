describe('cloud integrations without Supabase configuration', () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  afterEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
    jest.resetModules();
  });

  test('keeps anonymous-session initialization local when configuration is absent', async () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    jest.resetModules();

    const { ensureAnonymousSession } = jest.requireActual('../../src/data/auth-session') as typeof import('../../src/data/auth-session');

    await expect(ensureAnonymousSession()).resolves.toBeUndefined();
  });

  test('does not record cloud events when configuration is absent', async () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    jest.resetModules();

    const { recordEvent } = jest.requireActual('../../src/data/events-client') as typeof import('../../src/data/events-client');

    await expect(
      recordEvent({
        entityType: 'task_item',
        entityId: 'task-1',
        eventType: 'task_created',
      }),
    ).resolves.toBeUndefined();
  });
});
