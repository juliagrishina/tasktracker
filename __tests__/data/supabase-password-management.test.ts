import { createSupabasePasswordManagementGateway } from '../../src/data/supabase-password-management';

describe('Supabase password management gateway', () => {
  test('sends a six-digit sign-in code to the confirmed current email without replacing the active session', async () => {
    const client = createFakeClient();
    const passwordVerifier = createPasswordVerifier();
    const gateway = createSupabasePasswordManagementGateway(client, passwordVerifier);

    await expect(gateway.sendChangeCode()).resolves.toEqual({ email: 'maria@example.com' });

    expect(passwordVerifier.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'maria@example.com', options: { shouldCreateUser: false } });
  });

  test('keeps the current device signed in after code verification and revokes every other session', async () => {
    const client = createFakeClient();
    const passwordVerifier = createPasswordVerifier();
    const gateway = createSupabasePasswordManagementGateway(client, passwordVerifier);

    await gateway.sendChangeCode();
    await gateway.verifyChangeCode({ email: 'maria@example.com', code: '123456' });
    await gateway.setPassword({ currentPassword: 'Current!123', password: 'NewPassword!42' });

    expect(passwordVerifier.auth.verifyOtp).toHaveBeenCalledWith({ email: 'maria@example.com', token: '123456', type: 'email' });
    expect(passwordVerifier.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'maria@example.com', password: 'Current!123' });
    expect(passwordVerifier.auth.updateUser).toHaveBeenCalledWith({ password: 'NewPassword!42' });
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'maria@example.com', password: 'NewPassword!42' });
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
  });

  test('uses Supabase recovery OTP to establish the recovery session before setting the new password', async () => {
    const client = createFakeClient();
    const gateway = createSupabasePasswordManagementGateway(client, createPasswordVerifier());

    await gateway.sendRecoveryCode({ email: 'maria@example.com' });
    await gateway.verifyRecoveryCode({ email: 'maria@example.com', code: '123456' });
    await gateway.setRecoveredPassword({ password: 'Recovered!42' });

    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('maria@example.com');
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ email: 'maria@example.com', token: '123456', type: 'recovery' });
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'Recovered!42' });
  });
});

function createFakeClient() {
  return {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { email: 'maria@example.com' } } } }),
      resetPasswordForEmail: jest.fn<Promise<{ error: Error | null }>, [string]>().mockResolvedValue({ error: null }),
      signInWithPassword: jest.fn<Promise<{ error: Error | null }>, [{ email: string; password: string }]>().mockResolvedValue({ error: null }),
      signOut: jest.fn<Promise<{ error: Error | null }>, [{ scope: 'others' }]>().mockResolvedValue({ error: null }),
      updateUser: jest.fn<Promise<{ error: Error | null }>, [Record<string, unknown>]>().mockResolvedValue({ error: null }),
      verifyOtp: jest.fn<Promise<{ error: Error | null }>, [Record<string, unknown>]>().mockResolvedValue({ error: null }),
    },
  };
}

function createPasswordVerifier() {
  return {
    auth: {
      signInWithOtp: jest.fn<Promise<{ error: Error | null }>, [{ email: string; options: { shouldCreateUser: boolean } }]>().mockResolvedValue({ error: null }),
      signInWithPassword: jest.fn<Promise<{ error: Error | null }>, [{ email: string; password: string }]>().mockResolvedValue({ error: null }),
      updateUser: jest.fn<Promise<{ error: Error | null }>, [Record<string, unknown>]>().mockResolvedValue({ error: null }),
      verifyOtp: jest.fn<Promise<{ error: Error | null }>, [{ email: string; token: string; type: 'email' }]>().mockResolvedValue({ error: null }),
    },
  };
}
