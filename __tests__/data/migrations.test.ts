import { migrateDatabase } from '../../src/data/migrations';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

class PersistedMigrationDatabase {
  readonly database = new DatabaseSync(':memory:');

  async execAsync(sql: string): Promise<void> {
    this.database.exec(sql);
  }

  async getFirstAsync<T>(sql: string): Promise<T | null> {
    return (this.database.prepare(sql).get() as T | undefined) ?? null;
  }

  async withTransactionAsync(action: () => Promise<void>): Promise<void> {
    this.database.exec('BEGIN');
    try {
      await action();
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  async runAsync(sql: string, parameters: readonly unknown[]): Promise<void> {
    this.database.prepare(sql).run(...parameters as SQLInputValue[]);
  }
}

class MigrationDatabase {
  readonly executedSql: string[] = [];
  readonly appliedVersions: number[] = [];

  constructor(
    private latestVersion: number | null,
    private readonly failOnVersionSix = false,
  ) {}

  async execAsync(sql: string): Promise<void> {
    this.executedSql.push(sql);
    if (this.failOnVersionSix && sql.includes('recurrence_occurrences_v6')) {
      throw new Error('simulated v6 migration failure');
    }
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
    expect(database.appliedVersions).toEqual([2, 3, 4, 5, 6, 7]);
  });

  test('does not reapply migrations after the latest version is installed', async () => {
    const database = new MigrationDatabase(7);

    await migrateDatabase(database as never);

    expect(database.appliedVersions).toEqual([]);
  });

  test('rebuilds legacy reminders in migration three', async () => {
    const database = new MigrationDatabase(2);

    await migrateDatabase(database as never);

    expect(database.executedSql.join('\n')).toContain('reminders_v3');
    expect(database.appliedVersions).toEqual([3, 4, 5, 6, 7]);
  });

  test('rebuilds legacy recurrence series and creates occurrence exceptions in migration four', async () => {
    const database = new MigrationDatabase(3);

    await migrateDatabase(database as never);

    const sql = database.executedSql.join('\n');
    expect(sql).toContain('recurrence_series_v4');
    expect(sql).toContain("'task', task_item_id");
    expect(sql).toContain('recurrence_occurrences');
    expect(database.appliedVersions).toEqual([4, 5, 6, 7]);
  });

  test('stores instance-only task patches in migration five', async () => {
    const database = new MigrationDatabase(4);

    await migrateDatabase(database as never);

    expect(database.executedSql.join('\n')).toContain('ADD COLUMN task_patch');
    expect(database.appliedVersions).toEqual([5, 6, 7]);
  });

  test('adds completion and time-zone fields without dropping recurrence patches', async () => {
    const database = new MigrationDatabase(5);

    await migrateDatabase(database as never);

    const sql = database.executedSql.join('\n');
    expect(sql).toContain('time_zone_id');
    expect(sql).toContain('reminder_patch');
    expect(sql).toContain('completed_at');
    expect(sql).toContain("'completed'");
    expect(sql).toContain('task_patch');
    expect(database.appliedVersions).toEqual([6, 7]);
  });

  test('adds an explicit block override flag for recurrence exceptions', async () => {
    const database = new MigrationDatabase(6);

    await migrateDatabase(database as never);

    const sql = database.executedSql.join('\n');
    expect(sql).toContain('blocks_overridden');
    expect(sql).toContain('DEFAULT 0');
    expect(database.appliedVersions).toEqual([7]);
  });

  test('preserves persisted v6 task-patch exceptions that removed inherited time', async () => {
    const adapter = new PersistedMigrationDatabase();
    adapter.database.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      INSERT INTO schema_migrations (version, applied_at) VALUES (6, '2026-08-13T00:00:00.000Z');

      CREATE TABLE recurrence_series (
        id TEXT PRIMARY KEY
      );
      INSERT INTO recurrence_series (id) VALUES ('legacy-series');

      CREATE TABLE recurrence_occurrences (
        id TEXT PRIMARY KEY,
        series_id TEXT NOT NULL REFERENCES recurrence_series(id) ON DELETE CASCADE,
        occurs_on TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'completed')),
        task_patch TEXT,
        reminder_patch TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(series_id, occurs_on)
      );
      INSERT INTO recurrence_occurrences (
        id, series_id, occurs_on, status, task_patch, reminder_patch, completed_at, created_at
      ) VALUES
        ('legacy-no-time', 'legacy-series', '2026-08-13', 'active', '{"title":"Moved"}', NULL, NULL, '2026-08-13T00:00:00.000Z'),
        ('legacy-custom-time', 'legacy-series', '2026-08-14', 'active', '{"title":"Timed"}', NULL, NULL, '2026-08-13T00:00:00.000Z'),
        ('legacy-no-patch', 'legacy-series', '2026-08-15', 'active', NULL, NULL, NULL, '2026-08-13T00:00:00.000Z'),
        ('legacy-cancelled', 'legacy-series', '2026-08-16', 'cancelled', '{"title":"Cancelled"}', NULL, NULL, '2026-08-13T00:00:00.000Z');

      CREATE TABLE schedule_blocks (
        id TEXT PRIMARY KEY,
        occurrence_id TEXT REFERENCES recurrence_occurrences(id) ON DELETE SET NULL
      );
      INSERT INTO schedule_blocks (id, occurrence_id) VALUES ('custom-time', 'legacy-custom-time');
    `);

    await migrateDatabase(adapter as never);

    const rows = adapter.database.prepare(`
      SELECT id, blocks_overridden
      FROM recurrence_occurrences
      ORDER BY occurs_on
    `).all();
    expect(rows).toEqual([
      { id: 'legacy-no-time', blocks_overridden: 1 },
      { id: 'legacy-custom-time', blocks_overridden: 0 },
      { id: 'legacy-no-patch', blocks_overridden: 0 },
      { id: 'legacy-cancelled', blocks_overridden: 0 },
    ]);
  });

  test('restores foreign-key enforcement when the v6 schema migration fails', async () => {
    const database = new MigrationDatabase(5, true);

    await expect(migrateDatabase(database as never)).rejects.toThrow('simulated v6 migration failure');

    expect(database.executedSql.slice(-1)).toEqual(['PRAGMA foreign_keys = ON;']);
  });
});
