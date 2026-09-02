import { migrateLegacyDatabaseToAutonomousScope } from '../../src/data/local-data-scope-migration';

function createDatabase(hasSettingsTable: boolean) {
  return {
    getFirstAsync: jest.fn().mockResolvedValue(hasSettingsTable ? { name: 'settings' } : null),
    closeAsync: jest.fn().mockResolvedValue(undefined),
  };
}

describe('legacy autonomous data migration', () => {
  test('copies the existing SQLite database into the autonomous area without rewriting rows', async () => {
    const legacyDatabase = createDatabase(true);
    const autonomousDatabase = createDatabase(false);
    const backupDatabaseAsync = jest.fn().mockResolvedValue(undefined);
    const runtime = {
      openDatabaseAsync: jest
        .fn()
        .mockResolvedValueOnce(legacyDatabase)
        .mockResolvedValueOnce(autonomousDatabase),
      backupDatabaseAsync,
    };

    await expect(migrateLegacyDatabaseToAutonomousScope(runtime)).resolves.toEqual({ copied: true });

    expect(backupDatabaseAsync).toHaveBeenCalledWith({
      sourceDatabase: legacyDatabase,
      destDatabase: autonomousDatabase,
    });
    expect(legacyDatabase.closeAsync).toHaveBeenCalledTimes(1);
    expect(autonomousDatabase.closeAsync).toHaveBeenCalledTimes(1);
  });

  test('does not overwrite an autonomous database already created by a previous run', async () => {
    const legacyDatabase = createDatabase(true);
    const autonomousDatabase = createDatabase(true);
    const backupDatabaseAsync = jest.fn();
    const runtime = {
      openDatabaseAsync: jest
        .fn()
        .mockResolvedValueOnce(legacyDatabase)
        .mockResolvedValueOnce(autonomousDatabase),
      backupDatabaseAsync,
    };

    await expect(migrateLegacyDatabaseToAutonomousScope(runtime)).resolves.toEqual({ copied: false });
    expect(backupDatabaseAsync).not.toHaveBeenCalled();
  });
});
