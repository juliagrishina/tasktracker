import {
  PasswordManagementGatewayError,
  type PasswordManagementGateway,
} from '../application/password-management';

interface SupabaseWriteResult {
  error: Error | null;
}

interface SupabasePasswordUser {
  email: string | null;
}

export interface SupabasePasswordManagementClient {
  auth: {
    getSession(): Promise<{ data: { session: { user: SupabasePasswordUser } | null } }>;
    resetPasswordForEmail(email: string): Promise<SupabaseWriteResult>;
    signInWithPassword(input: { email: string; password: string }): Promise<SupabaseWriteResult>;
    signOut(input: { scope: 'others' }): Promise<SupabaseWriteResult>;
    updateUser(attributes: Record<string, unknown>): Promise<SupabaseWriteResult>;
    verifyOtp(input: { email: string; token: string; type: 'recovery' }): Promise<SupabaseWriteResult>;
  };
}

export interface SupabasePasswordVerifier {
  auth: {
    signInWithOtp(input: { email: string; options: { shouldCreateUser: boolean } }): Promise<SupabaseWriteResult>;
    signInWithPassword(input: { email: string; password: string }): Promise<SupabaseWriteResult>;
    updateUser(attributes: Record<string, unknown>): Promise<SupabaseWriteResult>;
    verifyOtp(input: { email: string; token: string; type: 'email' }): Promise<SupabaseWriteResult>;
  };
}

export function createSupabasePasswordManagementGateway(
  client: SupabasePasswordManagementClient | null,
  passwordVerifier: SupabasePasswordVerifier | null = null,
): PasswordManagementGateway {
  let changeEmail: string | null = null;

  return {
    sendChangeCode: async () => {
      const email = await currentEmail(requireClient(client));
      const verifier = requirePasswordVerifier(passwordVerifier);
      const { error } = await verifier.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error !== null) throw mapError(error, 'requestFailed');
      changeEmail = email;
      return { email };
    },
    verifyChangeCode: async ({ email, code }) => {
      const verifier = requirePasswordVerifier(passwordVerifier);
      const { error } = await verifier.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error !== null) throw mapError(error, 'invalidCode');
    },
    setPassword: async ({ currentPassword, password }) => {
      const email = changeEmail;
      if (email === null) throw new PasswordManagementGatewayError('requestFailed');
      const verifier = requirePasswordVerifier(passwordVerifier);
      const currentPasswordCheck = await verifier.auth.signInWithPassword({ email, password: currentPassword });
      if (currentPasswordCheck.error !== null) throw mapError(currentPasswordCheck.error, 'invalidCurrentPassword');

      const passwordUpdate = await verifier.auth.updateUser({ password });
      if (passwordUpdate.error !== null) throw mapError(passwordUpdate.error, 'requestFailed');

      const activeClient = requireClient(client);
      const activeSession = await activeClient.auth.signInWithPassword({ email, password });
      if (activeSession.error !== null) throw mapError(activeSession.error, 'requestFailed');
      const revokeOtherSessions = await activeClient.auth.signOut({ scope: 'others' });
      if (revokeOtherSessions.error !== null) throw mapError(revokeOtherSessions.error, 'requestFailed');
      changeEmail = null;
    },
    sendRecoveryCode: async ({ email }) => {
      const { error } = await requireClient(client).auth.resetPasswordForEmail(email);
      if (error !== null) throw mapError(error, 'requestFailed');
    },
    verifyRecoveryCode: async ({ email, code }) => {
      const { error } = await requireClient(client).auth.verifyOtp({ email, token: code, type: 'recovery' });
      if (error !== null) throw mapError(error, 'invalidCode');
    },
    setRecoveredPassword: async ({ password }) => {
      const { error } = await requireClient(client).auth.updateUser({ password });
      if (error !== null) throw mapError(error, 'requestFailed');
    },
  };
}

async function currentEmail(client: SupabasePasswordManagementClient): Promise<string> {
  const { data } = await client.auth.getSession();
  const email = data.session?.user.email;
  if (email === null || email === undefined) throw new PasswordManagementGatewayError('requestFailed');
  return email;
}

function mapError(error: Error, expectedKind: 'invalidCurrentPassword' | 'invalidCode' | 'requestFailed'): PasswordManagementGatewayError {
  const status = 'status' in error && typeof error.status === 'number' ? error.status : null;
  if (expectedKind !== 'requestFailed' && status === 400) return new PasswordManagementGatewayError(expectedKind);
  return new PasswordManagementGatewayError('requestFailed');
}

function requireClient(client: SupabasePasswordManagementClient | null): SupabasePasswordManagementClient {
  if (client === null) throw new PasswordManagementGatewayError('requestFailed');
  return client;
}

function requirePasswordVerifier(verifier: SupabasePasswordVerifier | null): SupabasePasswordVerifier {
  if (verifier === null) throw new PasswordManagementGatewayError('requestFailed');
  return verifier;
}
