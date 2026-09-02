import {
  createAccountRegistration,
  createMemoryPendingRegistrationStore,
  type AccountRegistrationGateway,
} from '../../src/application/account-registration';

describe('account registration', () => {
  test('links the current anonymous identity and persists no password while verification is pending', async () => {
    const gateway = new RecordingRegistrationGateway();
    const store = createMemoryPendingRegistrationStore();
    const registration = createAccountRegistration({ gateway, store, now: () => 1_000 });

    const result = await registration.start({
      displayName: 'Мария Иванова',
      email: 'maria@example.com',
      password: 'P@ssword2026',
      passwordConfirmation: 'P@ssword2026',
      termsAccepted: true,
    });

    expect(result).toEqual({ kind: 'pending', email: 'maria@example.com', userId: 'anon-user-17' });
    await expect(store.load()).resolves.toEqual({
      displayName: 'Мария Иванова',
      email: 'maria@example.com',
      issuedAtMs: 1_000,
      resendAvailableAtMs: 61_000,
      failedAttempts: 0,
      invalidated: false,
      userId: 'anon-user-17',
    });
    expect(gateway.linkedIdentity).toEqual({
      displayName: 'Мария Иванова',
      email: 'maria@example.com',
    });
  });

  test('activates the same account only after a valid six-digit code and records mandatory legal acceptance', async () => {
    const gateway = new RecordingRegistrationGateway();
    const store = createMemoryPendingRegistrationStore({
      displayName: 'Мария Иванова',
      email: 'maria@example.com',
      issuedAtMs: 1_000,
      resendAvailableAtMs: 61_000,
      failedAttempts: 0,
      invalidated: false,
      userId: 'anon-user-17',
    });
    const registration = createAccountRegistration({ gateway, store, now: () => 2_000 });

    const result = await registration.confirm({ code: '123456', password: 'P@ssword2026' });

    expect(result).toEqual({ kind: 'activated', email: 'maria@example.com', userId: 'anon-user-17' });
    expect(gateway.passwordsSet).toEqual(['P@ssword2026']);
    expect(gateway.accountSetups).toEqual([{ userId: 'anon-user-17', displayName: 'Мария Иванова' }]);
    await expect(store.load()).resolves.toBeNull();
  });

  test('invalidates the pending code after the third rejected confirmation', async () => {
    const gateway = new RecordingRegistrationGateway();
    gateway.rejectVerification = true;
    const store = createMemoryPendingRegistrationStore({
      displayName: 'Мария Иванова',
      email: 'maria@example.com',
      issuedAtMs: 1_000,
      resendAvailableAtMs: 61_000,
      failedAttempts: 0,
      invalidated: false,
      userId: 'anon-user-17',
    });
    const registration = createAccountRegistration({ gateway, store, now: () => 2_000 });

    await expect(registration.confirm({ code: '111111', password: 'P@ssword2026' })).resolves.toEqual({ kind: 'incorrectCode', attemptsRemaining: 2 });
    await expect(registration.confirm({ code: '222222', password: 'P@ssword2026' })).resolves.toEqual({ kind: 'incorrectCode', attemptsRemaining: 1 });
    await expect(registration.confirm({ code: '333333', password: 'P@ssword2026' })).resolves.toEqual({ kind: 'codeInvalidated' });
    await expect(store.load()).resolves.toMatchObject({ failedAttempts: 3, invalidated: true });
  });

  test('allows resending only after a minute and starts a fresh ten-minute verification window', async () => {
    const gateway = new RecordingRegistrationGateway();
    const store = createMemoryPendingRegistrationStore({
      displayName: 'Мария Иванова',
      email: 'maria@example.com',
      issuedAtMs: 1_000,
      resendAvailableAtMs: 61_000,
      failedAttempts: 2,
      invalidated: false,
      userId: 'anon-user-17',
    });
    let now = 60_999;
    const registration = createAccountRegistration({ gateway, store, now: () => now });

    await expect(registration.resend()).resolves.toEqual({ kind: 'resendCooldown', availableAtMs: 61_000 });
    now = 61_000;
    await expect(registration.resend()).resolves.toEqual({ kind: 'resent', email: 'maria@example.com' });
    await expect(store.load()).resolves.toMatchObject({
      issuedAtMs: 61_000,
      resendAvailableAtMs: 121_000,
      failedAttempts: 0,
      invalidated: false,
    });
  });
});

class RecordingRegistrationGateway implements AccountRegistrationGateway {
  linkedIdentity: { displayName: string; email: string } | null = null;
  passwordsSet: string[] = [];
  accountSetups: Array<{ userId: string; displayName: string }> = [];
  rejectVerification = false;

  async linkEmailIdentity(input: { displayName: string; email: string }): Promise<{ userId: string }> {
    this.linkedIdentity = input;
    return { userId: 'anon-user-17' };
  }

  async verifyEmailCode(): Promise<void> {
    if (this.rejectVerification) {
      throw new Error('Code is not valid');
    }
  }

  async setPassword(password: string): Promise<void> {
    this.passwordsSet.push(password);
  }

  async completeAccountSetup(input: { userId: string; displayName: string }): Promise<void> {
    this.accountSetups.push(input);
  }

  async resendEmailCode(): Promise<void> {}
}
