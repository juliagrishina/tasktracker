import type { PendingRegistration, PendingRegistrationStore } from '../application/account-registration';
import type { AuthEntryStorage } from './auth-entry-state';

const pendingRegistrationStorageKey = 'tasktracker.auth.pending-registration.v1';

export function createPendingRegistrationStore(storage: AuthEntryStorage): PendingRegistrationStore {
  return {
    load: async () => parsePendingRegistration(await storage.getItem(pendingRegistrationStorageKey)),
    save: async (value) => {
      await storage.setItem(pendingRegistrationStorageKey, JSON.stringify(value));
    },
    clear: async () => {
      await storage.setItem(pendingRegistrationStorageKey, '');
    },
  };
}

function parsePendingRegistration(value: string | null): PendingRegistration | null {
  if (value === null || value === '') {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<PendingRegistration>;
    const issuedAtMs = parsed.issuedAtMs;
    const resendAvailableAtMs = parsed.resendAvailableAtMs;
    const failedAttempts = parsed.failedAttempts;
    if (
      typeof parsed.userId !== 'string'
      || typeof parsed.displayName !== 'string'
      || typeof parsed.email !== 'string'
      || typeof issuedAtMs !== 'number'
      || !Number.isFinite(issuedAtMs)
      || typeof resendAvailableAtMs !== 'number'
      || !Number.isFinite(resendAvailableAtMs)
      || typeof failedAttempts !== 'number'
      || !Number.isInteger(failedAttempts)
      || failedAttempts < 0
      || typeof parsed.invalidated !== 'boolean'
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      displayName: parsed.displayName,
      email: parsed.email,
      issuedAtMs,
      resendAvailableAtMs,
      failedAttempts,
      invalidated: parsed.invalidated,
    };
  } catch {
    return null;
  }
}
