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
    expect(database.appliedVersions).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  test('does not reapply migrations after the latest version is installed', async () => {
    const database = new MigrationDatabase(15);

    await migrateDatabase(database as never);

    expect(database.appliedVersions).toEqual([]);
  });

  test('rebuilds legacy reminders in migration three', async () => {
    const database = new MigrationDatabase(2);

    await migrateDatabase(database as never);

    expect(database.executedSql.join('\n')).toContain('reminders_v3');
    expect(database.appliedVersions).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  test('drops the completed_items table in migration four', async () => {
    const database = new MigrationDatabase(3);

    await migrateDatabase(database as never);

    expect(database.executedSql.join('\n')).toContain('DROP TABLE completed_items');
    expect(database.appliedVersions).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  test('adds updated_at and deleted_at columns in migration five', async () => {
    const database = new MigrationDatabase(4);

    await migrateDatabase(database as never);

    const sql = database.executedSql.join('\n');
    expect(sql).toContain('ALTER TABLE projects ADD COLUMN updated_at TEXT');
    expect(sql).toContain('ALTER TABLE projects ADD COLUMN deleted_at TEXT');
    expect(sql).toContain('ALTER TABLE task_items ADD COLUMN updated_at TEXT');
    expect(sql).toContain('ALTER TABLE task_items ADD COLUMN deleted_at TEXT');
    expect(sql).toContain('ALTER TABLE reminders ADD COLUMN updated_at TEXT');
    expect(sql).toContain('ALTER TABLE reminders ADD COLUMN deleted_at TEXT');
    expect(sql).toContain('ALTER TABLE schedule_blocks ADD COLUMN updated_at TEXT');
    expect(sql).toContain('ALTER TABLE schedule_blocks ADD COLUMN deleted_at TEXT');
    expect(sql).toContain('ALTER TABLE recurrence_series ADD COLUMN updated_at TEXT');
    expect(sql).toContain('ALTER TABLE recurrence_series ADD COLUMN deleted_at TEXT');
    expect(database.appliedVersions).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  test('redefines the subtask-parent triggers to ignore soft-deleted parents in migration six', async () => {
    const database = new MigrationDatabase(5);

    await migrateDatabase(database as never);

    const sql = database.executedSql.join('\n');
    expect(sql).toContain('DROP TRIGGER IF EXISTS validate_subtask_parent_on_insert');
    expect(sql).toContain('DROP TRIGGER IF EXISTS validate_subtask_parent_on_update');
    expect(sql.match(/WHERE id = NEW\.parent_task_id AND deleted_at IS NULL/g)).toHaveLength(2);
    expect(database.appliedVersions).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  test('adds soft-delete-aware recurrence occurrences and timezone blocks in migration seven', async () => {
    const database = new MigrationDatabase(6);

    await migrateDatabase(database as never);

    const sql = database.executedSql.join('\n');
    expect(sql).toContain('ALTER TABLE schedule_blocks ADD COLUMN occurrence_id TEXT');
    expect(sql).toContain('ALTER TABLE schedule_blocks ADD COLUMN time_zone_id TEXT');
    expect(sql).toContain('CREATE TABLE recurrence_occurrences');
    expect(sql).toContain('deleted_at TEXT');
    expect(sql).toContain('recurrence_occurrences_live_series_date');
    expect(database.appliedVersions).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  test('adds task placement/history and expanded recurrence storage', async () => {
    const database = new MigrationDatabase(7);

    await migrateDatabase(database as never);

    const sql = database.executedSql.join('\n');
    expect(sql).toContain('ALTER TABLE task_items ADD COLUMN scheduled_on TEXT');
    expect(sql).toContain('CREATE TABLE transfer_history');
    expect(sql).toContain("'yearly', 'intervalDays'");
    expect(sql).toContain('weekdays_json TEXT');
    expect(database.appliedVersions).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
  });

  test('backfills a timezone for pre-existing schedule blocks', async () => {
    const database = new MigrationDatabase(9);

    await migrateDatabase(database as never);

    expect(database.executedSql.join('\n')).toContain("UPDATE schedule_blocks SET time_zone_id = 'UTC' WHERE time_zone_id IS NULL");
    expect(database.appliedVersions).toEqual([10, 11, 12, 13, 14, 15]);
  });

  test('stores the planning timezone in migration eleven', async () => {
    const database = new MigrationDatabase(10);

    await migrateDatabase(database as never);

    expect(database.executedSql.join('\n')).toContain('ALTER TABLE settings ADD COLUMN time_zone_id TEXT');
    expect(database.appliedVersions).toEqual([11, 12, 13, 14, 15]);
  });

  test('stores a schedule block notification identifier in migration twelve', async () => {
    const database = new MigrationDatabase(11);

    await migrateDatabase(database as never);

    expect(database.executedSql.join('\n')).toContain('ALTER TABLE schedule_blocks ADD COLUMN notification_id TEXT');
    expect(database.appliedVersions).toEqual([12, 13, 14, 15]);
  });

  test('stores the link from a follow-up reminder to its completed task in migration thirteen', async () => {
    const database = new MigrationDatabase(12);

    await migrateDatabase(database as never);

    const sql = database.executedSql.join('\n');
    expect(sql).toContain('ALTER TABLE reminders ADD COLUMN linked_task_item_id TEXT');
    expect(sql).toContain('ALTER TABLE reminders ADD COLUMN linked_occurrence_on TEXT');
    expect(database.appliedVersions).toEqual([13, 14, 15]);
  });

  test('stores the scheduled evening review notification identifier in migration fourteen', async () => {
    const database = new MigrationDatabase(13);

    await migrateDatabase(database as never);

    expect(database.executedSql.join('\n')).toContain('ALTER TABLE settings ADD COLUMN evening_review_notification_id TEXT');
    expect(database.appliedVersions).toEqual([14, 15]);
  });

  test('stores recurrence notification identifiers in migration fifteen', async () => {
    const database = new MigrationDatabase(14);

    await migrateDatabase(database as never);

    expect(database.executedSql.join('\n')).toContain('ALTER TABLE recurrence_occurrences ADD COLUMN notification_ids_json TEXT');
    expect(database.appliedVersions).toEqual([15]);
  });
});
