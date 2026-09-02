jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDataScopeRegistry } from '../../src/data/local-data-scope-registry.native';

describe('native local data scope registry', () => {
  test('persists only local scope metadata through the platform registry storage', async () => {
    await localDataScopeRegistry.openAccountScope('account-a');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'tasktracker.local-data-scopes.v1',
      expect.stringContaining('account-a'),
    );
  });
});
