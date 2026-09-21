import { createAuthEntryState } from './auth-entry-state';

export const authEntryState = createAuthEntryState({
  getItem: async (key) => getBrowserStorage().getItem(key),
  setItem: async (key, value) => getBrowserStorage().setItem(key, value),
});

function getBrowserStorage(): Storage {
  const storage = (globalThis as { localStorage?: Storage }).localStorage;
  if (storage === undefined) {
    throw new Error('Browser storage is unavailable for the Auth entry state.');
  }

  return storage;
}
