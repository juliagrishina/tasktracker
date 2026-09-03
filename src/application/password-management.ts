import { validateEmail, validatePassword, validatePasswordConfirmation } from '../domain/account-auth-validation';

const OTP_LIFETIME_MS = 10 * 60 * 1_000;
const RESEND_COOLDOWN_MS = 60 * 1_000;
const MAX_FAILED_OTP_ATTEMPTS = 3;

type PendingCode = {
  email: string | null;
  issuedAtMs: number;
  resendAvailableAtMs: number;
  failedAttempts: number;
  invalidated: boolean;
  verified: boolean;
};

export class PasswordManagementGatewayError extends Error {
  constructor(readonly kind: 'invalidCurrentPassword' | 'invalidCode' | 'requestFailed') {
    super(kind);
  }
}

export interface PasswordManagementGateway {
  sendChangeCode(): Promise<{ email: string }>;
  verifyChangeCode(input: { email: string; code: string }): Promise<void>;
  setPassword(input: { currentPassword: string; password: string }): Promise<void>;
  sendRecoveryCode(input: { email: string }): Promise<void>;
  verifyRecoveryCode(input: { email: string; code: string }): Promise<void>;
  setRecoveredPassword(input: { password: string }): Promise<void>;
}

export type PasswordManagementResult =
  | { kind: 'codeSent' }
  | { kind: 'passwordChanged' }
  | { kind: 'recoveryRequested' }
  | { kind: 'passwordRecovered' }
  | { kind: 'validationError'; message: string }
  | { kind: 'missingCodeRequest' }
  | { kind: 'expiredCode' }
  | { kind: 'codeInvalidated' }
  | { kind: 'incorrectCode'; attemptsRemaining: number }
  | { kind: 'resendCooldown'; availableAtMs: number }
  | { kind: 'requestFailed'; message: string };

export interface PasswordManagement {
  requestPasswordChangeCode(): Promise<PasswordManagementResult>;
  resendPasswordChangeCode(): Promise<PasswordManagementResult>;
  changePassword(input: { currentPassword: string; code: string; password: string; passwordConfirmation: string }): Promise<PasswordManagementResult>;
  requestPasswordRecovery(email: string): Promise<PasswordManagementResult>;
  resendPasswordRecoveryCode(): Promise<PasswordManagementResult>;
  completePasswordRecovery(input: { email: string; code: string; password: string; passwordConfirmation: string }): Promise<PasswordManagementResult>;
}

export function createPasswordManagement({
  gateway,
  now = () => Date.now(),
}: {
  gateway: PasswordManagementGateway;
  now?: () => number;
}): PasswordManagement {
  let changeCode: PendingCode | null = null;
  let recoveryCode: PendingCode | null = null;

  const requestRecoveryCode = async (email: string): Promise<PasswordManagementResult> => {
    const existing = recoveryCode;
    const currentTime = now();
    if (existing !== null && currentTime < existing.resendAvailableAtMs) {
      return { kind: 'resendCooldown', availableAtMs: existing.resendAvailableAtMs };
    }

    try {
      await gateway.sendRecoveryCode({ email });
    } catch {
      return { kind: 'requestFailed', message: 'Не удалось отправить код. Проверьте подключение к интернету.' };
    }

    const pending: PendingCode = {
      email,
      issuedAtMs: currentTime,
      resendAvailableAtMs: currentTime + RESEND_COOLDOWN_MS,
      failedAttempts: 0,
      invalidated: false,
      verified: false,
    };
    recoveryCode = pending;
    return { kind: 'recoveryRequested' };
  };

  const requestChangeCode = async (): Promise<PasswordManagementResult> => {
    const currentTime = now();
    if (changeCode !== null && currentTime < changeCode.resendAvailableAtMs) {
      return { kind: 'resendCooldown', availableAtMs: changeCode.resendAvailableAtMs };
    }

    try {
      const { email } = await gateway.sendChangeCode();
      changeCode = {
        email,
        issuedAtMs: currentTime,
        resendAvailableAtMs: currentTime + RESEND_COOLDOWN_MS,
        failedAttempts: 0,
        invalidated: false,
        verified: false,
      };
      return { kind: 'codeSent' };
    } catch (error) {
      if (error instanceof PasswordManagementGatewayError && error.kind === 'invalidCurrentPassword') {
        return { kind: 'validationError', message: 'Текущий пароль неверный.' };
      }
      return { kind: 'requestFailed', message: 'Не удалось отправить код. Проверьте подключение к интернету.' };
    }
  };

  const validateCode = (pending: PendingCode | null, code: string): PasswordManagementResult | null => {
    if (pending === null) return { kind: 'missingCodeRequest' };
    if (!/^\d{6}$/u.test(code)) return { kind: 'validationError', message: 'Введите шестизначный код.' };
    if (pending.invalidated) return { kind: 'codeInvalidated' };
    if (now() >= pending.issuedAtMs + OTP_LIFETIME_MS) return { kind: 'expiredCode' };
    return null;
  };

  const recordRejectedCode = (pending: PendingCode): PasswordManagementResult => {
    pending.failedAttempts += 1;
    pending.invalidated = pending.failedAttempts >= MAX_FAILED_OTP_ATTEMPTS;
    return pending.invalidated
      ? { kind: 'codeInvalidated' }
      : { kind: 'incorrectCode', attemptsRemaining: MAX_FAILED_OTP_ATTEMPTS - pending.failedAttempts };
  };

  const codeFailureResult = (error: unknown, pending: PendingCode): PasswordManagementResult => {
    if (error instanceof PasswordManagementGatewayError && error.kind === 'requestFailed') {
      return { kind: 'requestFailed', message: 'Не удалось проверить код. Проверьте подключение к интернету.' };
    }
    return recordRejectedCode(pending);
  };

  const validateNewPassword = (password: string, passwordConfirmation: string): PasswordManagementResult | null => {
    const validation = validatePassword(password);
    if (!validation.isValid) {
      return { kind: 'validationError', message: passwordErrorMessage(validation.missingRequirements) };
    }
    const confirmation = validatePasswordConfirmation(password, passwordConfirmation);
    if (confirmation.error !== null) return { kind: 'validationError', message: confirmation.error };
    return null;
  };

  return {
    requestPasswordChangeCode: requestChangeCode,
    resendPasswordChangeCode: requestChangeCode,
    changePassword: async ({ currentPassword, code, password, passwordConfirmation }) => {
      if (currentPassword === '') return { kind: 'validationError', message: 'Введите текущий пароль.' };
      const codeError = validateCode(changeCode, code);
      if (codeError !== null) return codeError;
      const passwordError = validateNewPassword(password, passwordConfirmation);
      if (passwordError !== null) return passwordError;

      const pendingChange = changeCode as PendingCode;
      if (!pendingChange.verified) {
        try {
          await gateway.verifyChangeCode({ email: pendingChange.email as string, code });
          pendingChange.verified = true;
        } catch (error) {
          return codeFailureResult(error, pendingChange);
        }
      }

      try {
        await gateway.setPassword({ currentPassword, password });
      } catch (error) {
        if (error instanceof PasswordManagementGatewayError && error.kind === 'invalidCurrentPassword') {
          return { kind: 'validationError', message: 'Текущий пароль неверный.' };
        }
        return { kind: 'requestFailed', message: 'Не удалось сохранить новый пароль. Проверьте подключение к интернету.' };
      }
      changeCode = null;
      return { kind: 'passwordChanged' };
    },
    requestPasswordRecovery: async (email) => {
      const normalizedEmail = validateEmail(email);
      if (normalizedEmail.error !== null) return { kind: 'validationError', message: normalizedEmail.error };
      return requestRecoveryCode(normalizedEmail.value as string);
    },
    resendPasswordRecoveryCode: () => {
      if (recoveryCode === null || recoveryCode.email === null) return Promise.resolve({ kind: 'missingCodeRequest' });
      return requestRecoveryCode(recoveryCode.email);
    },
    completePasswordRecovery: async ({ email, code, password, passwordConfirmation }) => {
      const normalizedEmail = validateEmail(email);
      if (normalizedEmail.error !== null) return { kind: 'validationError', message: normalizedEmail.error };
      const pendingRecovery = recoveryCode;
      if (pendingRecovery === null || pendingRecovery.email !== normalizedEmail.value) return { kind: 'missingCodeRequest' };
      const codeError = validateCode(pendingRecovery, code);
      if (codeError !== null) return codeError;
      const passwordError = validateNewPassword(password, passwordConfirmation);
      if (passwordError !== null) return passwordError;

      if (!pendingRecovery.verified) {
        try {
          await gateway.verifyRecoveryCode({ email: normalizedEmail.value as string, code });
          pendingRecovery.verified = true;
        } catch (error) {
          return codeFailureResult(error, pendingRecovery);
        }
      }

      try {
        await gateway.setRecoveredPassword({ password });
      } catch {
        return { kind: 'requestFailed', message: 'Не удалось сохранить новый пароль. Проверьте подключение к интернету.' };
      }
      recoveryCode = null;
      return { kind: 'passwordRecovered' };
    },
  };
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
