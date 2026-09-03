import {
  createAccountProfileService,
  type AccountProfile,
  type AccountProfileCache,
  type AccountProfileGateway,
} from '../../src/application/account-profile';

describe('account profile service', () => {
  test('keeps the current email active while a validated email change waits for new-address OTP', async () => {
    const gateway = new RecordingAccountProfileGateway();
    const cache = createMemoryProfileCache();
    const profile = createAccountProfileService({ cache, gateway });

    await expect(profile.startEmailChange({ currentPassword: 'Current!123', email: 'new@example.com' }))
      .resolves.toEqual({ kind: 'pendingEmailChange', email: 'new@example.com' });

    expect(gateway.emailChangeRequests).toEqual([{ currentPassword: 'Current!123', email: 'new@example.com' }]);
    await expect(profile.load()).resolves.toEqual({
      kind: 'authenticated',
      displayName: 'Мария Иванова',
      email: 'maria@example.com',
      emailConfirmed: true,
      pendingEmail: 'new@example.com',
    });
  });

  test('confirms only the pending new address with its OTP and removes its pending state', async () => {
    const gateway = new RecordingAccountProfileGateway();
    gateway.onlineProfile = { ...gateway.onlineProfile!, pendingEmail: 'new@example.com' };
    const cache = createMemoryProfileCache({
      userId: 'user-17',
      displayName: 'Мария Иванова',
      email: 'maria@example.com',
      emailConfirmed: true,
      pendingEmail: 'new@example.com',
    });
    const profile = createAccountProfileService({ cache, gateway });

    await expect(profile.confirmEmailChange({ code: '123456' })).resolves.toEqual({ kind: 'emailChanged', email: 'new@example.com' });

    expect(gateway.verifiedEmailCodes).toEqual([{ email: 'new@example.com', code: '123456' }]);
    await expect(profile.load()).resolves.toEqual({
      kind: 'authenticated',
      displayName: 'Мария Иванова',
      email: 'new@example.com',
      emailConfirmed: true,
      pendingEmail: null,
    });
  });

  test('updates the canonical name online and keeps its cached copy available offline', async () => {
    const gateway = new RecordingAccountProfileGateway();
    const cache = createMemoryProfileCache();
    const profile = createAccountProfileService({ cache, gateway });

    await expect(profile.updateDisplayName('  Мария   Петрова  ')).resolves.toEqual({ kind: 'displayNameUpdated', displayName: 'Мария Петрова' });
    expect(gateway.displayNameUpdates).toEqual(['Мария Петрова']);

    gateway.onlineProfile = null;
    await expect(profile.load()).resolves.toEqual({
      kind: 'authenticated',
      displayName: 'Мария Петрова',
      email: 'maria@example.com',
      emailConfirmed: true,
      pendingEmail: null,
    });
  });

  test('cancels the server pending email change without changing the current email', async () => {
    const gateway = new RecordingAccountProfileGateway();
    gateway.onlineProfile = { ...gateway.onlineProfile!, pendingEmail: 'new@example.com' };
    const cache = createMemoryProfileCache({
      userId: 'user-17',
      displayName: 'Мария Иванова',
      email: 'maria@example.com',
      emailConfirmed: true,
      pendingEmail: 'new@example.com',
    });
    const profile = createAccountProfileService({ cache, gateway });

    await expect(profile.cancelEmailChange()).resolves.toEqual({ kind: 'emailChangeCancelled' });

    expect(gateway.cancelledEmailChanges).toEqual(['user-17']);
    await expect(profile.load()).resolves.toMatchObject({ email: 'maria@example.com', pendingEmail: null });
  });
});

class RecordingAccountProfileGateway implements AccountProfileGateway {
  onlineProfile: AccountProfile | null = {
    userId: 'user-17',
    displayName: 'Мария Иванова',
    email: 'maria@example.com',
    emailConfirmed: true,
    pendingEmail: null,
  };
  readonly emailChangeRequests: Array<{ currentPassword: string; email: string }> = [];
  readonly verifiedEmailCodes: Array<{ email: string; code: string }> = [];
  readonly displayNameUpdates: string[] = [];
  readonly cancelledEmailChanges: string[] = [];

  async getProfile() {
    if (this.onlineProfile === null) throw new Error('offline');
    return this.onlineProfile;
  }

  async updateDisplayName(displayName: string) {
    this.displayNameUpdates.push(displayName);
    this.onlineProfile = { ...this.requireOnlineProfile(), displayName };
  }

  async requestEmailChange(input: { currentPassword: string; email: string }) {
    this.emailChangeRequests.push(input);
    this.onlineProfile = { ...this.requireOnlineProfile(), pendingEmail: input.email };
  }

  async verifyEmailChange(input: { email: string; code: string }) {
    this.verifiedEmailCodes.push(input);
    this.onlineProfile = { ...this.requireOnlineProfile(), email: input.email, pendingEmail: null };
  }

  async cancelEmailChange(userId: string) {
    this.cancelledEmailChanges.push(userId);
    this.onlineProfile = { ...this.requireOnlineProfile(), pendingEmail: null };
  }

  private requireOnlineProfile(): AccountProfile {
    if (this.onlineProfile === null) throw new Error('offline');
    return this.onlineProfile;
  }
}

function createMemoryProfileCache(initial: AccountProfile | null = null): AccountProfileCache {
  let value: AccountProfile | null = initial;
  return {
    load: async () => value,
    save: async (profile) => {
      value = profile;
    },
  };
}
