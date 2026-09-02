import AsyncStorage from '@react-native-async-storage/async-storage';

import { createAuthEntryState } from './auth-entry-state';

export const authEntryState = createAuthEntryState({
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
});
