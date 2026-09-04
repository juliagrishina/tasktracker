jest.mock('expo-sqlite', () => ({
  backupDatabaseAsync: jest.fn(),
  openDatabaseAsync: jest.fn(),
}));

jest.mock('../../src/data/migrations', () => ({
  migrateDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/data/local-data-scope-migration', () => ({
  migrateLegacyDatabaseToAutonomousScope: jest.fn().mockResolvedValue({ copied: false }),
}));

jest.mock('../../src/data/native-legacy-id-migration', () => ({
  migrateLegacyIdsInNativeDatabase: jest.fn().mockResolvedValue(undefined),
}));

import { createDataSource } from '../../src/data/data-source.native';

describe('native scoped data source', () => {
  test('opens an account-scoped database instead of the autonomous database', async () => {
    const database = {};
    const { openDatabaseAsync } = jest.requireMock('expo-sqlite') as {
      openDatabaseAsync: jest.Mock;
    };
    openDatabaseAsync.mockResolvedValue(database);

    const source = createDataSource({ kind: 'account', accountId: 'account-a' });
    await source.initialize();

    expect(openDatabaseAsync).toHaveBeenCalledWith('tasktracker-account-account-a.db');
  });
});
