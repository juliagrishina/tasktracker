import { createDataScopeRegistry, type DataScopeStorage } from './local-data-scopes';

const browserScopeStorage: DataScopeStorage = {
  getItem: async (key) => getBrowserStorage().getItem(key),
  setItem: async (key, value) => getBrowserStorage().setItem(key, value),
};

export const localDataScopeRegistry = createDataScopeRegistry(browserScopeStorage);

function getBrowserStorage(): Storage {
  const storage = (globalThis as { localStorage?: Storage }).localStorage;
  if (storage === undefined) {
    throw new Error('Browser storage is unavailable for local data scopes.');
  }

  return storage;
}
