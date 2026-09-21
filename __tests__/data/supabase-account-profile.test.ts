import { createSupabaseAccountProfileGateway } from '../../src/data/supabase-account-profile';

describe('Supabase account profile gateway', () => {
  test('maps Auth user fields to the account profile, including a pending new email', async () => {
    const client = createFakeSupabaseClient();
    const gateway = createSupabaseAccountProfileGateway(client);

    await expect(gateway.getProfile()).resolves.toEqual({
      userId: 'user-17',
      displayName: 'Мария Иванова',
      email: 'maria@example.com',
      emailConfirmed: true,
      pendingEmail: 'new@example.com',
    });
  });

  test('sends current password only with the online Auth request for a new email', async () => {
    const client = createFakeSupabaseClient();
    const gateway = createSupabaseAccountProfileGateway(client);

    await gateway.updateDisplayName('Мария Петрова');
    await gateway.requestEmailChange({ email: 'new@example.com', currentPassword: 'Current!123' });
    await gateway.verifyEmailChange({ email: 'new@example.com', code: '123456' });
    await gateway.cancelEmailChange('user-17');

    expect(client.auth.updateUserCalls).toEqual([
      { data: { display_name: 'Мария Петрова' } },
      { email: 'new@example.com', current_password: 'Current!123' },
    ]);
    expect(client.auth.verifyOtpCalls).toEqual([{ email: 'new@example.com', token: '123456', type: 'email_change' }]);
    expect(client.functions.invokeCalls).toEqual([{ name: 'cancel-email-change', body: undefined }]);
  });
});

function createFakeSupabaseClient() {
  const auth = {
    updateUserCalls: [] as Array<Record<string, unknown>>,
    verifyOtpCalls: [] as Array<Record<string, unknown>>,
    getSession: async () => ({
      data: {
        session: {
          user: {
            id: 'user-17',
            email: 'maria@example.com',
            email_confirmed_at: '2026-09-01T10:00:00.000Z',
            new_email: 'new@example.com',
            user_metadata: { display_name: 'Мария Иванова' },
          },
        },
      },
    }),
    updateUser: async (input: Record<string, unknown>) => {
      auth.updateUserCalls.push(input);
      return { data: { user: {} }, error: null };
    },
    verifyOtp: async (input: Record<string, unknown>) => {
      auth.verifyOtpCalls.push(input);
      return { data: { user: {} }, error: null };
    },
  };
  const functions = {
    invokeCalls: [] as Array<{ name: string; body: unknown }>,
    invoke: async (name: string, input?: { body?: unknown }) => {
      functions.invokeCalls.push({ name, body: input?.body });
      return { data: { cancelled: true }, error: null };
    },
  };
  return { auth, functions };
}
