import type { AccountProfile, AccountProfileGateway } from '../application/account-profile';

interface SupabaseProfileUser {
  id: string;
  email: string | null;
  email_confirmed_at: string | null;
  new_email?: string;
  user_metadata: { display_name?: unknown };
}

interface SupabaseWriteResult {
  error: Error | null;
}

export interface SupabaseAccountProfileClient {
  auth: {
    getSession(): Promise<{ data: { session: { user: SupabaseProfileUser } | null } }>;
    updateUser(attributes: Record<string, unknown>): Promise<SupabaseWriteResult>;
    verifyOtp(input: { email: string; token: string; type: 'email_change' }): Promise<SupabaseWriteResult>;
  };
  functions: {
    invoke(name: 'cancel-email-change', input?: { body?: unknown }): Promise<{ data: unknown; error: Error | null }>;
  };
}

export function createSupabaseAccountProfileGateway(
  client: SupabaseAccountProfileClient | null,
): AccountProfileGateway {
  return {
    getProfile: async () => {
      const activeClient = requireClient(client);
      const { data } = await activeClient.auth.getSession();
      const user = data.session?.user;
      if (user === undefined || user.email === null) return null;
      return toAccountProfile(user);
    },
    updateDisplayName: async (displayName) => {
      const { error } = await requireClient(client).auth.updateUser({ data: { display_name: displayName } });
      if (error !== null) throw error;
    },
    requestEmailChange: async ({ currentPassword, email }) => {
      const { error } = await requireClient(client).auth.updateUser({ email, current_password: currentPassword });
      if (error !== null) throw error;
    },
    verifyEmailChange: async ({ email, code }) => {
      const { error } = await requireClient(client).auth.verifyOtp({ email, token: code, type: 'email_change' });
      if (error !== null) throw error;
    },
    cancelEmailChange: async () => {
      const { error } = await requireClient(client).functions.invoke('cancel-email-change');
      if (error !== null) throw error;
    },
  };
}

function toAccountProfile(user: SupabaseProfileUser): AccountProfile {
  return {
    userId: user.id,
    displayName: typeof user.user_metadata.display_name === 'string' ? user.user_metadata.display_name : '',
    email: user.email as string,
    emailConfirmed: user.email_confirmed_at !== null,
    pendingEmail: user.new_email ?? null,
  };
}

function requireClient(client: SupabaseAccountProfileClient | null): SupabaseAccountProfileClient {
  if (client === null) {
    throw new Error('Supabase account profile is unavailable.');
  }
  return client;
}
