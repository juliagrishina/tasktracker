import { migrateDatabase } from '../../src/data/migrations';

class MigrationDatabase {
  readonly executedSql: string[] = [];
  readonly appliedVersions: number[] = [];

  constructor(private latestVersion: number | null) {}

  async execAsync(sql: string): Promise<void> {
    this.executedSql.push(sql);
  }

  async getFirstAsync<T>(): Promise<T | null> {
    return this.latestVersion === null
      ? null
      : ({ version: this.latestVersion } as T);
  }

  async withTransactionAsync(action: () => Promise<void>): Promise<void> {
    await action();
  }

  async runAsync(sql: string, parameters: readonly unknown[]): Promise<void> {
    if (sql.includes('schema_migrations')) {
      const version = parameters[0];
      if (typeof version === 'number') {
        this.appliedVersions.push(version);
        this.latestVersion = version;
      }
    }
  }
}

describe('migrateDatabase', () => {
  test('applies pending migrations to a version-one database', async () => {
    const database = new MigrationDatabase(1);

    await migrateDatabase(database as never);

    expect(database.executedSql.some((sql) => sql.includes('ALTER TABLE reminders ADD COLUMN title'))).toBe(true);
    expect(database.appliedVersions).toEqual([2, 3, 4]);
  });

  test('does not reapply migrations after the latest version is installed', async () => {
    const database = new MigrationDatabase(4);

    await migrateDatabase(database as never);

    expect(database.appliedVersions).toEqual([]);
  });

  test('rebuilds legacy reminders in migration three', async () => {
    const database = new MigrationDatabase(2);

    await migrateDatabase(database as never);

    expect(database.executedSql.join('\n')).toContain('reminders_v3');
    expect(database.appliedVersions).toEqual([3, 4]);
  });

  test('rebuilds legacy recurrence series and creates occurrence exceptions in migration four', async () => {
    const database = new MigrationDatabase(3);

    await migrateDatabase(database as never);

    const sql = database.executedSql.join('\n');
    expect(sql).toContain('recurrence_series_v4');
    expect(sql).toContain("'task', task_item_id");
    expect(sql).toContain('recurrence_occurrences');
    expect(database.appliedVersions).toEqual([4]);
  });
});
