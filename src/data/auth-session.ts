import { supabase } from './supabase-client';

export interface AuthSessionSnapshot {
  user: {
    id: string;
    isAnonymous: boolean;
    email: string | null;
    emailConfirmedAt: string | null;
    expiresAt: number | null;
  };
}

export type AuthSessionState =
  | { kind: 'autonomous'; userId: string | null }
  | { kind: 'pendingVerification'; userId: string; email: string }
  | { kind: 'authenticated'; userId: string; email: string }
  | { kind: 'signedOut' };

export interface AuthGateway {
  restoreSession(nowMs?: number): Promise<AuthSessionState>;
}

export interface SupabaseAuthGateway extends AuthGateway {
  startAutonomousSession(): Promise<AuthSessionState>;
  signInWithPassword(input: { email: string; password: string }): Promise<AuthSessionState>;
  subscribe(listener: (state: AuthSessionState) => void): () => void;
}

export interface AuthGatewaySessionReader {
  getSession(): Promise<AuthSessionSnapshot | null>;
}

interface SupabaseSessionLike {
  expires_at: number | null;
  user: {
    id: string;
    is_anonymous: boolean;
    email: string | null;
    email_confirmed_at: string | null;
  };
}

interface SupabaseSignInResult {
  data: { session: SupabaseSessionLike | null };
  error: Error | null;
}

export interface SupabaseAuthGatewayClient {
  auth: {
    getSession(): Promise<{ data: { session: SupabaseSessionLike | null } }>;
    signInAnonymously?(): Promise<SupabaseSignInResult>;
    signInWithPassword?(input: { email: string; password: string }): Promise<SupabaseSignInResult>;
    onAuthStateChange?(
      listener: (event: string, session: SupabaseSessionLike | null) => void,
    ): { data: { subscription: { unsubscribe(): void } } };
  };
}

export function createAuthGateway(sessionReader: AuthGatewaySessionReader): AuthGateway {
  return {
    restoreSession: async (nowMs = Date.now()) =>
      resolveAuthSessionState(await sessionReader.getSession(), nowMs),
  };
}

export function createSupabaseAuthGateway(
  client: SupabaseAuthGatewayClient | null,
): SupabaseAuthGateway {
  const gateway = createAuthGateway({
    getSession: async () =>
      client === null
        ? null
        : toAuthSessionSnapshot((await client.auth.getSession()).data.session),
  });

  return {
    ...gateway,
    startAutonomousSession: async () => {
      const currentState = await gateway.restoreSession();
      if (currentState.kind !== 'signedOut') {
        return currentState;
      }

      if (client === null) {
        return { kind: 'autonomous', userId: null };
      }

      const signInAnonymously = client.auth.signInAnonymously;
      if (signInAnonymously === undefined) {
        throw new Error('Anonymous Supabase sign-in is unavailable.');
      }

      const { data, error } = await signInAnonymously();
      if (error !== null) {
        throw error;
      }

      return resolveAuthSessionState(toAuthSessionSnapshot(data.session));
    },
    signInWithPassword: async (input) => {
      if (client === null || client.auth.signInWithPassword === undefined) {
        throw new Error('Email and password sign-in is unavailable.');
      }

      const { data, error } = await client.auth.signInWithPassword(input);
      if (error !== null) {
        throw error;
      }

      return resolveAuthSessionState(toAuthSessionSnapshot(data.session));
    },
    subscribe: (listener) => {
      if (client === null || client.auth.onAuthStateChange === undefined) {
        return () => {};
      }

      const { data } = client.auth.onAuthStateChange((_event, session) => {
        listener(resolveAuthSessionState(toAuthSessionSnapshot(session)));
      });
      return () => data.subscription.unsubscribe();
    },
  };
}

export function resolveAuthSessionState(
  session: AuthSessionSnapshot | null,
  nowMs = Date.now(),
): AuthSessionState {
  if (session === null) {
    return { kind: 'signedOut' };
  }

  const { user } = session;
  if (user.expiresAt !== null && user.expiresAt * 1_000 <= nowMs) {
    return { kind: 'signedOut' };
  }

  if (user.isAnonymous) {
    return { kind: 'autonomous', userId: user.id };
  }

  if (user.email === null || user.emailConfirmedAt === null) {
    return {
      kind: 'pendingVerification',
      userId: user.id,
      email: user.email ?? '',
    };
  }

  return {
    kind: 'authenticated',
    userId: user.id,
    email: user.email,
  };
}

/**
 * Ensures a Supabase identity exists for this device before any cloud
 * write (e.g. event recording) is attempted. No registration UI is
 * involved: an anonymous auth.users row is created on first launch and
 * persisted by the platform-specific protected session storage.
 */
export const authGateway = createSupabaseAuthGateway(
  supabase as unknown as SupabaseAuthGatewayClient | null,
);

export async function ensureAnonymousSession(): Promise<void> {
  await authGateway.startAutonomousSession();
}

function toAuthSessionSnapshot(session: SupabaseSessionLike | null): AuthSessionSnapshot | null {
  if (session === null) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      isAnonymous: session.user.is_anonymous,
      email: session.user.email,
      emailConfirmedAt: session.user.email_confirmed_at,
      expiresAt: session.expires_at,
    },
  };
}
