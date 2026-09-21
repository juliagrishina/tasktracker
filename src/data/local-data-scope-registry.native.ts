import AsyncStorage from '@react-native-async-storage/async-storage';

import { createDataScopeRegistry } from './local-data-scopes';

export const localDataScopeRegistry = createDataScopeRegistry({
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
});
