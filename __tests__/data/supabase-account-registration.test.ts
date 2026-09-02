import { createSupabaseAccountRegistrationGateway } from '../../src/data/supabase-account-registration';

describe('Supabase account-registration gateway', () => {
  test('links email identity without sending the password before email verification', async () => {
    const client = createFakeSupabaseClient();
    const gateway = createSupabaseAccountRegistrationGateway(client);

    await expect(gateway.linkEmailIdentity({ email: 'maria@example.com', displayName: 'Мария Иванова' }))
      .resolves.toEqual({ userId: 'anon-user-17' });

    expect(client.auth.updateUserCalls).toEqual([
      { email: 'maria@example.com', data: { display_name: 'Мария Иванова' } },
    ]);
  });

  test('writes mandatory legal acceptances only after the verified account setup completes', async () => {
    const client = createFakeSupabaseClient();
    const gateway = createSupabaseAccountRegistrationGateway(client);

    await gateway.completeAccountSetup({ userId: 'anon-user-17', displayName: 'Мария Иванова' });

    expect(client.rows.legal_acceptances).toEqual([
      expect.objectContaining({ user_id: 'anon-user-17', document_type: 'terms_of_use' }),
      expect.objectContaining({ user_id: 'anon-user-17', document_type: 'privacy_policy' }),
    ]);
    expect(client.rows.privacy_preferences).toEqual([
      { user_id: 'anon-user-17', analytics_events_enabled: false },
    ]);
  });
});

function createFakeSupabaseClient() {
  const rows: Record<string, unknown[]> = {
    legal_acceptances: [],
    privacy_preferences: [],
  };
  const auth = {
    updateUserCalls: [] as Array<Record<string, unknown>>,
    updateUser: async (attributes: Record<string, unknown>) => {
      auth.updateUserCalls.push(attributes);
      return { data: { user: { id: 'anon-user-17' } }, error: null };
    },
    verifyOtp: async () => ({ data: { user: { id: 'anon-user-17' } }, error: null }),
    resend: async () => ({ error: null }),
  };

  return {
    auth,
    rows,
    from: (table: string) => ({
      upsert: async (value: unknown) => {
        rows[table].push(...(Array.isArray(value) ? value : [value]));
        return { error: null };
      },
    }),
  };
}
