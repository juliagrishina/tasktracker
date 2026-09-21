import type { AuthSessionState } from './auth-session';

const autonomousEntryStorageKey = 'tasktracker.auth-entry.autonomous.v1';

export interface AuthEntryStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface AuthEntryState {
  shouldOpenApp(session: AuthSessionState): Promise<boolean>;
  continueWithoutAccount(): Promise<void>;
}

export function createAuthEntryState(storage: AuthEntryStorage): AuthEntryState {
  return {
    shouldOpenApp: async (session) => {
      if (session.kind === 'authenticated') {
        return true;
      }

      if (session.kind !== 'autonomous') {
        return false;
      }

      return (await storage.getItem(autonomousEntryStorageKey)) === 'true';
    },
    continueWithoutAccount: async () => {
      await storage.setItem(autonomousEntryStorageKey, 'true');
    },
  };
}
