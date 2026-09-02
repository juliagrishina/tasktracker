import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface AuthSessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface NativeSecureStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface WebSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createNativeAuthSessionStorage(
  secureStore: NativeSecureStore,
): AuthSessionStorage {
  return {
    getItem: (key) => secureStore.getItemAsync(key),
    setItem: (key, value) => secureStore.setItemAsync(key, value),
    removeItem: (key) => secureStore.deleteItemAsync(key),
  };
}

export function createWebAuthSessionStorage(
  storage: WebSessionStorage,
): AuthSessionStorage {
  return {
    getItem: async (key) => storage.getItem(key),
    setItem: async (key, value) => storage.setItem(key, value),
    removeItem: async (key) => storage.removeItem(key),
  };
}

export const authSessionStorage: AuthSessionStorage =
  Platform.OS === 'web'
    ? createWebAuthSessionStorage(getWebSessionStorage())
    : createNativeAuthSessionStorage(SecureStore);

function getWebSessionStorage(): WebSessionStorage {
  const storage = (globalThis as { localStorage?: WebSessionStorage }).localStorage;
  return storage ?? createMemoryWebSessionStorage();
}

function createMemoryWebSessionStorage(): WebSessionStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}
