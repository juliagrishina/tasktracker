import {
  createAuthGateway,
  createSupabaseAuthGateway,
  resolveAuthSessionState,
  type AuthSessionSnapshot,
} from '../../src/data/auth-session';

const anonymousSession: AuthSessionSnapshot = {
  user: {
    id: 'anonymous-user',
    isAnonymous: true,
    email: null,
    emailConfirmedAt: null,
    expiresAt: null,
  },
};

describe('Auth session state machine', () => {
  test('identifies an anonymous Supabase identity as an autonomous session', () => {
    expect(resolveAuthSessionState(anonymousSession)).toEqual({
      kind: 'autonomous',
      userId: 'anonymous-user',
    });
  });

  test('identifies an email identity awaiting verification', () => {
    const session: AuthSessionSnapshot = {
      user: {
        id: 'pending-user',
        isAnonymous: false,
        email: 'anna@example.com',
        emailConfirmedAt: null,
        expiresAt: null,
      },
    };

    expect(resolveAuthSessionState(session)).toEqual({
      kind: 'pendingVerification',
      userId: 'pending-user',
      email: 'anna@example.com',
    });
  });

  test('identifies a confirmed email identity as an authenticated session', () => {
    const session: AuthSessionSnapshot = {
      user: {
        id: 'account-user',
        isAnonymous: false,
        email: 'anna@example.com',
        emailConfirmedAt: '2026-09-02T08:00:00.000Z',
        expiresAt: null,
      },
    };

    expect(resolveAuthSessionState(session)).toEqual({
      kind: 'authenticated',
      userId: 'account-user',
      email: 'anna@example.com',
    });
  });

  test('identifies a missing session as signed out', () => {
    expect(resolveAuthSessionState(null)).toEqual({ kind: 'signedOut' });
  });

  test('restores an authenticated session until its access token expires', async () => {
    const session: AuthSessionSnapshot = {
      user: {
        id: 'account-user',
        isAnonymous: false,
        email: 'anna@example.com',
        emailConfirmedAt: '2026-09-02T08:00:00.000Z',
        expiresAt: 1_788_336_000,
      },
    };
    const gateway = createAuthGateway({
      getSession: jest.fn().mockResolvedValue(session),
    });

    await expect(gateway.restoreSession(1_788_335_999_000)).resolves.toEqual({
      kind: 'authenticated',
      userId: 'account-user',
      email: 'anna@example.com',
    });
    await expect(gateway.restoreSession(1_788_336_000_000)).resolves.toEqual({
      kind: 'signedOut',
    });
  });

  test('adapts the Supabase session shape before restoring the Auth state', async () => {
    const gateway = createSupabaseAuthGateway({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              expires_at: null,
              user: {
                id: 'account-user',
                is_anonymous: false,
                email: 'anna@example.com',
                email_confirmed_at: '2026-09-02T08:00:00.000Z',
              },
            },
          },
        }),
      },
    });

    await expect(gateway.restoreSession()).resolves.toEqual({
      kind: 'authenticated',
      userId: 'account-user',
      email: 'anna@example.com',
    });
  });

  test('starts an autonomous session only when no session is restored', async () => {
    const anonymousSupabaseSession = {
      expires_at: null,
      user: {
        id: 'anonymous-user',
        is_anonymous: true,
        email: null,
        email_confirmed_at: null,
      },
    };
    const signInAnonymously = jest.fn().mockResolvedValue({
      data: { session: anonymousSupabaseSession },
      error: null,
    });
    const gateway = createSupabaseAuthGateway({
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
        signInAnonymously,
      },
    });

    await expect(gateway.startAutonomousSession()).resolves.toEqual({
      kind: 'autonomous',
      userId: 'anonymous-user',
    });
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });

  test('signs in with email and password and returns the confirmed account state', async () => {
    const gateway = createSupabaseAuthGateway({
      auth: {
        getSession: jest.fn(),
        signInWithPassword: jest.fn().mockResolvedValue({
          data: {
            session: {
              expires_at: null,
              user: {
                id: 'account-user',
                is_anonymous: false,
                email: 'anna@example.com',
                email_confirmed_at: '2026-09-02T08:00:00.000Z',
              },
            },
          },
          error: null,
        }),
      },
    });

    await expect(gateway.signInWithPassword({ email: 'anna@example.com', password: 'P@ssword2026' })).resolves.toEqual({
      kind: 'authenticated',
      userId: 'account-user',
      email: 'anna@example.com',
    });
  });

  test('notifies subscribers when Supabase reports an Auth state change', () => {
    const unsubscribe = jest.fn();
    const listener = jest.fn();
    const gateway = createSupabaseAuthGateway({
      auth: {
        getSession: jest.fn(),
        onAuthStateChange: jest.fn((onChange) => {
          onChange('SIGNED_IN', {
            expires_at: null,
            user: {
              id: 'account-user',
              is_anonymous: false,
              email: 'anna@example.com',
              email_confirmed_at: '2026-09-02T08:00:00.000Z',
            },
          });
          return { data: { subscription: { unsubscribe } } };
        }),
      },
    });

    const stop = gateway.subscribe(listener);

    expect(listener).toHaveBeenCalledWith({
      kind: 'authenticated',
      userId: 'account-user',
      email: 'anna@example.com',
    });
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
