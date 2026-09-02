import {
  validateAccountName,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from '../domain/account-auth-validation';

const otpLifetimeMs = 10 * 60 * 1_000;
const resendCooldownMs = 60 * 1_000;
const maxFailedOtpAttempts = 3;

export interface PendingRegistration {
  userId: string;
  displayName: string;
  email: string;
  issuedAtMs: number;
  resendAvailableAtMs: number;
  failedAttempts: number;
  invalidated: boolean;
}

export interface PendingRegistrationStore {
  load(): Promise<PendingRegistration | null>;
  save(value: PendingRegistration): Promise<void>;
  clear(): Promise<void>;
}

export interface AccountRegistrationGateway {
  linkEmailIdentity(input: { email: string; displayName: string }): Promise<{ userId: string }>;
  verifyEmailCode(input: { email: string; code: string }): Promise<void>;
  setPassword(password: string): Promise<void>;
  completeAccountSetup(input: { userId: string; displayName: string }): Promise<void>;
  resendEmailCode(input: { email: string }): Promise<void>;
}

export interface AccountRegistrationInput {
  displayName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  termsAccepted: boolean;
}

export type AccountRegistrationResult =
  | { kind: 'pending'; userId: string; email: string }
  | { kind: 'validationError'; field: 'displayName' | 'email' | 'password' | 'passwordConfirmation' | 'termsAccepted'; message: string }
  | { kind: 'requestFailed'; message: string };

export type RegistrationValidationError = Extract<AccountRegistrationResult, { kind: 'validationError' }>;

export type ConfirmRegistrationResult =
  | { kind: 'activated'; userId: string; email: string }
  | { kind: 'missingPendingRegistration' }
  | { kind: 'invalidCodeFormat' }
  | { kind: 'expiredCode' }
  | { kind: 'codeInvalidated' }
  | { kind: 'incorrectCode'; attemptsRemaining: number }
  | { kind: 'invalidPassword'; message: string }
  | { kind: 'requestFailed'; message: string };

export type ResendRegistrationResult =
  | { kind: 'resent'; email: string }
  | { kind: 'resendCooldown'; availableAtMs: number }
  | { kind: 'missingPendingRegistration' }
  | { kind: 'requestFailed'; message: string };

export interface AccountRegistration {
  start(input: AccountRegistrationInput): Promise<AccountRegistrationResult>;
  confirm(input: { code: string; password: string }): Promise<ConfirmRegistrationResult>;
  resend(): Promise<ResendRegistrationResult>;
  getPending(): Promise<PendingRegistration | null>;
}

export function createAccountRegistration({
  gateway,
  store,
  now = () => Date.now(),
}: {
  gateway: AccountRegistrationGateway;
  store: PendingRegistrationStore;
  now?: () => number;
}): AccountRegistration {
  return {
    start: async (input) => {
      const validationError = validateAccountRegistrationInput(input);
      if (validationError !== null) {
        return validationError;
      }

      const displayName = validateAccountName(input.displayName).value as string;
      const email = validateEmail(input.email).value as string;
      try {
        const { userId } = await gateway.linkEmailIdentity({ displayName, email });
        const issuedAtMs = now();
        await store.save({
          userId,
          displayName,
          email,
          issuedAtMs,
          resendAvailableAtMs: issuedAtMs + resendCooldownMs,
          failedAttempts: 0,
          invalidated: false,
        });
        return { kind: 'pending', userId, email };
      } catch {
        return { kind: 'requestFailed', message: 'Не удалось отправить код. Попробуйте ещё раз.' };
      }
    },
    confirm: async ({ code, password }) => {
      const pending = await store.load();
      if (pending === null) {
        return { kind: 'missingPendingRegistration' };
      }
      if (!/^\d{6}$/u.test(code)) {
        return { kind: 'invalidCodeFormat' };
      }
      if (pending.invalidated) {
        return { kind: 'codeInvalidated' };
      }
      if (now() >= pending.issuedAtMs + otpLifetimeMs) {
        return { kind: 'expiredCode' };
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return { kind: 'invalidPassword', message: passwordErrorMessage(passwordValidation.missingRequirements) };
      }

      try {
        await gateway.verifyEmailCode({ email: pending.email, code });
      } catch {
        const failedAttempts = pending.failedAttempts + 1;
        const invalidated = failedAttempts >= maxFailedOtpAttempts;
        await store.save({ ...pending, failedAttempts, invalidated });
        return invalidated
          ? { kind: 'codeInvalidated' }
          : { kind: 'incorrectCode', attemptsRemaining: maxFailedOtpAttempts - failedAttempts };
      }

      try {
        await gateway.setPassword(password);
        await gateway.completeAccountSetup({ userId: pending.userId, displayName: pending.displayName });
        await store.clear();
        return { kind: 'activated', userId: pending.userId, email: pending.email };
      } catch {
        return { kind: 'requestFailed', message: 'Не удалось завершить регистрацию. Попробуйте ещё раз.' };
      }
    },
    resend: async () => {
      const pending = await store.load();
      if (pending === null) {
        return { kind: 'missingPendingRegistration' };
      }
      const currentTime = now();
      if (currentTime < pending.resendAvailableAtMs) {
        return { kind: 'resendCooldown', availableAtMs: pending.resendAvailableAtMs };
      }
      try {
        await gateway.resendEmailCode({ email: pending.email });
        await store.save({
          ...pending,
          issuedAtMs: currentTime,
          resendAvailableAtMs: currentTime + resendCooldownMs,
          failedAttempts: 0,
          invalidated: false,
        });
        return { kind: 'resent', email: pending.email };
      } catch {
        return { kind: 'requestFailed', message: 'Не удалось отправить новый код. Попробуйте ещё раз.' };
      }
    },
    getPending: () => store.load(),
  };
}

export function createMemoryPendingRegistrationStore(initial: PendingRegistration | null = null): PendingRegistrationStore {
  let value = initial;
  return {
    load: async () => value,
    save: async (next) => {
      value = next;
    },
    clear: async () => {
      value = null;
    },
  };
}

export function validateAccountRegistrationInput(input: AccountRegistrationInput): RegistrationValidationError | null {
  const name = validateAccountName(input.displayName);
  if (name.error !== null) {
    return { kind: 'validationError', field: 'displayName', message: name.error };
  }
  const email = validateEmail(input.email);
  if (email.error !== null) {
    return { kind: 'validationError', field: 'email', message: email.error };
  }
  const password = validatePassword(input.password);
  if (!password.isValid) {
    return { kind: 'validationError', field: 'password', message: passwordErrorMessage(password.missingRequirements) };
  }
  const confirmation = validatePasswordConfirmation(input.password, input.passwordConfirmation);
  if (confirmation.error !== null) {
    return { kind: 'validationError', field: 'passwordConfirmation', message: confirmation.error };
  }
  if (!input.termsAccepted) {
    return {
      kind: 'validationError',
      field: 'termsAccepted',
      message: 'Подтвердите принятие Пользовательского соглашения и Политики конфиденциальности.',
    };
  }
  return null;
}

function passwordErrorMessage(requirements: readonly string[]): string {
  const descriptions: Record<string, string> = {
    minimumLength: 'не менее 10 символов',
    lowercaseLetter: 'строчная буква',
    uppercaseLetter: 'заглавная буква',
    digit: 'цифра',
    specialCharacter: 'специальный символ',
  };
  return `Пароль должен содержать: ${requirements.map((requirement) => descriptions[requirement]).join(', ')}.`;
}
