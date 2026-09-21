import { createPendingRegistrationStore } from './pending-registration-store';

const memoryStorage = new Map<string, string>();

export const pendingRegistrationStore = createPendingRegistrationStore({
  getItem: async (key) => getBrowserStorage()?.getItem(key) ?? memoryStorage.get(key) ?? null,
  setItem: async (key, value) => {
    const storage = getBrowserStorage();
    if (storage === null) {
      memoryStorage.set(key, value);
      return;
    }
    storage.setItem(key, value);
  },
});

function getBrowserStorage(): Storage | null {
  return (globalThis as { localStorage?: Storage }).localStorage ?? null;
}
