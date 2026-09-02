import AsyncStorage from '@react-native-async-storage/async-storage';

import { createPendingRegistrationStore } from './pending-registration-store';

export const pendingRegistrationStore = createPendingRegistrationStore({
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
});
