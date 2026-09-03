import { validateAccountName, validateEmail } from '../domain/account-auth-validation';

export interface AccountProfile {
  userId: string;
  displayName: string;
  email: string;
  emailConfirmed: boolean;
  pendingEmail: string | null;
}

export interface AccountProfileCache {
  load(): Promise<AccountProfile | null>;
  save(profile: AccountProfile): Promise<void>;
}

/** Only the Auth adapter may perform the online mutations in this interface. */
export interface AccountProfileGateway {
  getProfile(): Promise<AccountProfile | null>;
  updateDisplayName(displayName: string): Promise<void>;
  requestEmailChange(input: { currentPassword: string; email: string }): Promise<void>;
  verifyEmailChange(input: { email: string; code: string }): Promise<void>;
  cancelEmailChange(userId: string): Promise<void>;
}

export type AccountProfileState =
  | { kind: 'authenticated'; displayName: string; email: string; emailConfirmed: boolean; pendingEmail: string | null }
  | { kind: 'withoutAccount' };

export type AccountProfileResult =
  | { kind: 'displayNameUpdated'; displayName: string }
  | { kind: 'pendingEmailChange'; email: string }
  | { kind: 'emailChanged'; email: string }
  | { kind: 'emailChangeCancelled' }
  | { kind: 'validationError'; field: 'displayName' | 'email' | 'code' | 'currentPassword'; message: string }
  | { kind: 'requestFailed'; message: string };

export interface AccountProfileService {
  load(): Promise<AccountProfileState>;
  updateDisplayName(input: string): Promise<AccountProfileResult>;
  startEmailChange(input: { currentPassword: string; email: string }): Promise<AccountProfileResult>;
  confirmEmailChange(input: { code: string }): Promise<AccountProfileResult>;
  cancelEmailChange(): Promise<AccountProfileResult>;
}

export function createAccountProfileService({
  cache,
  gateway,
}: {
  cache: AccountProfileCache;
  gateway: AccountProfileGateway;
}): AccountProfileService {
  const toState = (profile: AccountProfile): AccountProfileState => ({
    kind: 'authenticated',
    displayName: profile.displayName,
    email: profile.email,
    emailConfirmed: profile.emailConfirmed,
    pendingEmail: profile.pendingEmail,
  });

  const loadOnlineProfile = async (): Promise<AccountProfile | null> => {
    const profile = await gateway.getProfile();
    if (profile !== null) await cache.save(profile);
    return profile;
  };

  const currentProfile = async (): Promise<AccountProfile | null> => {
    try {
      return await loadOnlineProfile();
    } catch {
      return cache.load();
    }
  };

  return {
    async load(): Promise<AccountProfileState> {
      const profile = await currentProfile();
      return profile === null ? { kind: 'withoutAccount' } : toState(profile);
    },

    async updateDisplayName(input: string): Promise<AccountProfileResult> {
      const validation = validateAccountName(input);
      if (validation.error !== null) {
        return { kind: 'validationError', field: 'displayName', message: validation.error };
      }
      const displayName = validation.value as string;
      try {
        const profile = await loadOnlineProfile();
        if (profile === null) return { kind: 'requestFailed', message: 'Войдите в аккаунт, чтобы изменить имя.' };
        await gateway.updateDisplayName(displayName);
        await cache.save({ ...profile, displayName });
        return { kind: 'displayNameUpdated', displayName };
      } catch {
        return { kind: 'requestFailed', message: 'Не удалось изменить имя. Проверьте подключение к интернету.' };
      }
    },

    async startEmailChange(input: { currentPassword: string; email: string }): Promise<AccountProfileResult> {
      const validation = validateEmail(input.email);
      if (validation.error !== null) {
        return { kind: 'validationError', field: 'email', message: validation.error };
      }
      if (input.currentPassword === '') {
        return { kind: 'validationError', field: 'currentPassword', message: 'Введите текущий пароль.' };
      }
      const email = validation.value as string;
      try {
        const profile = await loadOnlineProfile();
        if (profile === null) return { kind: 'requestFailed', message: 'Войдите в аккаунт, чтобы изменить email.' };
        if (profile.email === email) {
          return { kind: 'validationError', field: 'email', message: 'Укажите другой email.' };
        }
        await gateway.requestEmailChange({ currentPassword: input.currentPassword, email });
        await cache.save({ ...profile, pendingEmail: email });
        return { kind: 'pendingEmailChange', email };
      } catch {
        return { kind: 'requestFailed', message: 'Не удалось начать смену email. Проверьте пароль и подключение к интернету.' };
      }
    },

    async confirmEmailChange(input: { code: string }): Promise<AccountProfileResult> {
      if (!/^\d{6}$/u.test(input.code)) {
        return { kind: 'validationError', field: 'code', message: 'Введите шестизначный код.' };
      }
      try {
        const profile = await currentProfile();
        if (profile?.pendingEmail === null || profile === null) {
          return { kind: 'requestFailed', message: 'Нет ожидающей смены email.' };
        }
        await gateway.verifyEmailChange({ email: profile.pendingEmail, code: input.code });
        const updated = { ...profile, email: profile.pendingEmail, pendingEmail: null };
        await cache.save(updated);
        return { kind: 'emailChanged', email: updated.email };
      } catch {
        return { kind: 'requestFailed', message: 'Не удалось подтвердить email. Проверьте код и подключение к интернету.' };
      }
    },

    async cancelEmailChange(): Promise<AccountProfileResult> {
      try {
        const profile = await loadOnlineProfile();
        if (profile?.pendingEmail === null || profile === null) {
          return { kind: 'requestFailed', message: 'Нет ожидающей смены email.' };
        }
        await gateway.cancelEmailChange(profile.userId);
        await cache.save({ ...profile, pendingEmail: null });
        return { kind: 'emailChangeCancelled' };
      } catch {
        return { kind: 'requestFailed', message: 'Не удалось отменить смену email. Проверьте подключение к интернету.' };
      }
    },
  };
}
