import type { AccountRegistrationGateway } from '../application/account-registration';

const legalDocumentVersion = '2026-09-01';

interface SupabaseAuthUser {
  id: string;
}

interface SupabaseAuthResult {
  data: { user: SupabaseAuthUser | null };
  error: Error | null;
}

interface SupabaseWriteResult {
  error: Error | null;
}

export interface SupabaseAccountRegistrationClient {
  auth: {
    updateUser(attributes: Record<string, unknown>): Promise<SupabaseAuthResult>;
    verifyOtp(input: { email: string; token: string; type: 'email_change' }): Promise<SupabaseAuthResult>;
    resend(input: { email: string; type: 'email_change' }): Promise<{ error: Error | null }>;
  };
  from(table: 'legal_acceptances' | 'privacy_preferences'): {
    upsert(value: unknown, options?: { onConflict?: string; ignoreDuplicates?: boolean }): Promise<SupabaseWriteResult>;
  };
}

export function createSupabaseAccountRegistrationGateway(
  client: SupabaseAccountRegistrationClient | null,
): AccountRegistrationGateway {
  return {
    linkEmailIdentity: async ({ email, displayName }) => {
      const activeClient = requireClient(client);
      const { data, error } = await activeClient.auth.updateUser({
        email,
        data: { display_name: displayName },
      });
      if (error !== null || data.user === null) {
        throw error ?? new Error('Supabase did not return the updated user.');
      }
      return { userId: data.user.id };
    },
    verifyEmailCode: async ({ email, code }) => {
      const activeClient = requireClient(client);
      const { error } = await activeClient.auth.verifyOtp({ email, token: code, type: 'email_change' });
      if (error !== null) {
        throw error;
      }
    },
    setPassword: async (password) => {
      const activeClient = requireClient(client);
      const { error } = await activeClient.auth.updateUser({ password });
      if (error !== null) {
        throw error;
      }
    },
    completeAccountSetup: async ({ userId }) => {
      const activeClient = requireClient(client);
      const legalAcceptance = await activeClient.from('legal_acceptances').upsert(
        [
          {
            user_id: userId,
            document_type: 'terms_of_use',
            document_version: legalDocumentVersion,
            source: 'app',
          },
          {
            user_id: userId,
            document_type: 'privacy_policy',
            document_version: legalDocumentVersion,
            source: 'app',
          },
        ],
        { onConflict: 'user_id,document_type,document_version', ignoreDuplicates: true },
      );
      if (legalAcceptance.error !== null) {
        throw legalAcceptance.error;
      }

      const privacyPreferences = await activeClient.from('privacy_preferences').upsert(
        { user_id: userId, analytics_events_enabled: false },
        { onConflict: 'user_id', ignoreDuplicates: true },
      );
      if (privacyPreferences.error !== null) {
        throw privacyPreferences.error;
      }
    },
    resendEmailCode: async ({ email }) => {
      const activeClient = requireClient(client);
      const { error } = await activeClient.auth.resend({ email, type: 'email_change' });
      if (error !== null) {
        throw error;
      }
    },
  };
}

function requireClient(client: SupabaseAccountRegistrationClient | null): SupabaseAccountRegistrationClient {
  if (client === null) {
    throw new Error('Supabase account registration is unavailable.');
  }
  return client;
}
