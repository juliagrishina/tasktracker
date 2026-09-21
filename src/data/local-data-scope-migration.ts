import { databaseNameForScope } from './local-data-scopes';

export const legacyDatabaseName = 'tasktracker.db';
export const autonomousDatabaseName = databaseNameForScope({ kind: 'autonomous' });

export interface ScopeMigrationDatabase {
  getFirstAsync<T>(query: string, parameters?: readonly unknown[]): Promise<T | null>;
  closeAsync(): Promise<void>;
}

export interface ScopeMigrationRuntime {
  openDatabaseAsync(name: string): Promise<ScopeMigrationDatabase>;
  backupDatabaseAsync(input: {
    sourceDatabase: ScopeMigrationDatabase;
    destDatabase: ScopeMigrationDatabase;
  }): Promise<void>;
}

export async function migrateLegacyDatabaseToAutonomousScope(
  runtime: ScopeMigrationRuntime,
): Promise<{ copied: boolean }> {
  const legacyDatabase = await runtime.openDatabaseAsync(legacyDatabaseName);
  const autonomousDatabase = await runtime.openDatabaseAsync(autonomousDatabaseName);

  try {
    const [legacyHasData, autonomousHasData] = await Promise.all([
      hasApplicationSchema(legacyDatabase),
      hasApplicationSchema(autonomousDatabase),
    ]);

    if (!legacyHasData || autonomousHasData) {
      return { copied: false };
    }

    await runtime.backupDatabaseAsync({
      sourceDatabase: legacyDatabase,
      destDatabase: autonomousDatabase,
    });
    return { copied: true };
  } finally {
    await Promise.all([legacyDatabase.closeAsync(), autonomousDatabase.closeAsync()]);
  }
}

async function hasApplicationSchema(database: ScopeMigrationDatabase): Promise<boolean> {
  const table = await database.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    ['settings'],
  );
  return table !== null;
}
