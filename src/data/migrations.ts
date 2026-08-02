import type { SQLiteDatabase } from 'expo-sqlite';

import { getDefaultSettings } from './default-settings';

interface Migration {
  version: number;
  apply(database: SQLiteDatabase): Promise<void>;
}

const schemaVersionTable = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`;

const schemaVersionOne = `
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    workday_starts_at TEXT NOT NULL,
    workday_ends_at TEXT NOT NULL,
    evening_review_at TEXT NOT NULL,
    notification_lead_minutes INTEGER NOT NULL CHECK (notification_lead_minutes >= 0)
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS task_items (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('task', 'subtask')),
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    parent_task_id TEXT REFERENCES task_items(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CHECK (
      (kind = 'task' AND parent_task_id IS NULL)
      OR (kind = 'subtask' AND parent_task_id IS NOT NULL)
    )
  );

  CREATE TRIGGER IF NOT EXISTS validate_subtask_parent_on_insert
  BEFORE INSERT ON task_items
  WHEN NEW.kind = 'subtask'
    AND COALESCE((SELECT kind FROM task_items WHERE id = NEW.parent_task_id), '') != 'task'
  BEGIN
    SELECT RAISE(ABORT, 'Subtask parent must be a task');
  END;

  CREATE TRIGGER IF NOT EXISTS validate_subtask_parent_on_update
  BEFORE UPDATE OF kind, parent_task_id ON task_items
  WHEN NEW.kind = 'subtask'
    AND COALESCE((SELECT kind FROM task_items WHERE id = NEW.parent_task_id), '') != 'task'
  BEGIN
    SELECT RAISE(ABORT, 'Subtask parent must be a task');
  END;

  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    task_item_id TEXT REFERENCES task_items(id) ON DELETE CASCADE,
    project_id TEXT CHECK (project_id IS NULL),
    reminds_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS schedule_blocks (
    id TEXT PRIMARY KEY,
    task_item_id TEXT NOT NULL REFERENCES task_items(id) ON DELETE CASCADE,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CHECK (starts_at < ends_at),
    CHECK (CAST(strftime('%M', starts_at) AS INTEGER) % 5 = 0),
    CHECK (CAST(strftime('%M', ends_at) AS INTEGER) % 5 = 0)
  );

  CREATE TABLE IF NOT EXISTS recurrence_series (
    id TEXT PRIMARY KEY,
    task_item_id TEXT NOT NULL REFERENCES task_items(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    interval INTEGER NOT NULL CHECK (interval > 0),
    starts_on TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS completed_items (
    id TEXT PRIMARY KEY,
    task_item_id TEXT NOT NULL REFERENCES task_items(id) ON DELETE CASCADE,
    completed_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`;

const schemaVersionTwo = `
  ALTER TABLE reminders ADD COLUMN title TEXT NOT NULL DEFAULT '';
`;

const migrations: readonly Migration[] = [
  {
    version: 1,
    async apply(database) {
      await database.execAsync(schemaVersionOne);
      const defaults = getDefaultSettings();
      await database.runAsync(
        `INSERT OR IGNORE INTO settings (
          id,
          workday_starts_at,
          workday_ends_at,
          evening_review_at,
          notification_lead_minutes
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          1,
          defaults.workdayStartsAt,
          defaults.workdayEndsAt,
          defaults.eveningReviewAt,
          defaults.notificationLeadMinutes,
        ],
      );
    },
  },
  {
    version: 2,
    async apply(database) {
      await database.execAsync(schemaVersionTwo);
    },
  },
];

export async function migrateDatabase(database: SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = ON;');
  await database.execAsync(schemaVersionTable);

  const latestMigration = await database.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1',
  );
  const latestVersion = latestMigration?.version ?? 0;

  await database.withTransactionAsync(async () => {
    for (const migration of migrations) {
      if (migration.version <= latestVersion) {
        continue;
      }

      await migration.apply(database);
      await database.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        [migration.version, new Date().toISOString()],
      );
    }
  });
}
