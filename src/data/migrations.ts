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

const schemaVersionThree = `
  ALTER TABLE projects ADD COLUMN description TEXT;
  ALTER TABLE projects ADD COLUMN completed_at TEXT;

  ALTER TABLE task_items ADD COLUMN description TEXT;
  ALTER TABLE task_items ADD COLUMN estimated_duration_minutes INTEGER
    CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0);
  ALTER TABLE task_items ADD COLUMN completed_at TEXT;

  CREATE TABLE reminders_v3 (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    reminds_on TEXT,
    period_start_on TEXT,
    period_end_on TEXT,
    repeat_frequency TEXT CHECK (
      repeat_frequency IS NULL OR repeat_frequency IN ('daily', 'weekly', 'monthly')
    ),
    repeat_interval INTEGER CHECK (
      repeat_interval IS NULL OR repeat_interval > 0
    ),
    estimated_duration_minutes INTEGER CHECK (
      estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0
    ),
    completed_at TEXT,
    created_at TEXT NOT NULL,
    CHECK (
      (period_start_on IS NULL AND period_end_on IS NULL)
      OR (period_start_on IS NOT NULL AND period_end_on IS NOT NULL AND period_start_on <= period_end_on)
    ),
    CHECK (
      (repeat_frequency IS NULL AND repeat_interval IS NULL)
      OR (repeat_frequency IS NOT NULL AND repeat_interval IS NOT NULL)
    )
  );

  INSERT INTO reminders_v3 (
    id,
    title,
    reminds_on,
    period_start_on,
    period_end_on,
    repeat_frequency,
    repeat_interval,
    estimated_duration_minutes,
    completed_at,
    created_at
  )
  SELECT
    id,
    title,
    date(reminds_at),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    created_at
  FROM reminders;

  DROP TABLE reminders;
  ALTER TABLE reminders_v3 RENAME TO reminders;
`;

const schemaVersionFour = `
  DROP TABLE completed_items;
`;

const schemaVersionFive = `
  ALTER TABLE projects ADD COLUMN updated_at TEXT;
  ALTER TABLE projects ADD COLUMN deleted_at TEXT;
  ALTER TABLE task_items ADD COLUMN updated_at TEXT;
  ALTER TABLE task_items ADD COLUMN deleted_at TEXT;
  ALTER TABLE reminders ADD COLUMN updated_at TEXT;
  ALTER TABLE reminders ADD COLUMN deleted_at TEXT;
  ALTER TABLE schedule_blocks ADD COLUMN updated_at TEXT;
  ALTER TABLE schedule_blocks ADD COLUMN deleted_at TEXT;
  ALTER TABLE recurrence_series ADD COLUMN updated_at TEXT;
  ALTER TABLE recurrence_series ADD COLUMN deleted_at TEXT;

  UPDATE projects SET updated_at = created_at WHERE updated_at IS NULL;
  UPDATE task_items SET updated_at = created_at WHERE updated_at IS NULL;
  UPDATE reminders SET updated_at = created_at WHERE updated_at IS NULL;
  UPDATE schedule_blocks SET updated_at = created_at WHERE updated_at IS NULL;
  UPDATE recurrence_series SET updated_at = created_at WHERE updated_at IS NULL;
`;

const schemaVersionSix = `
  DROP TRIGGER IF EXISTS validate_subtask_parent_on_insert;
  DROP TRIGGER IF EXISTS validate_subtask_parent_on_update;

  CREATE TRIGGER validate_subtask_parent_on_insert
  BEFORE INSERT ON task_items
  WHEN NEW.kind = 'subtask'
    AND COALESCE(
      (SELECT kind FROM task_items WHERE id = NEW.parent_task_id AND deleted_at IS NULL),
      ''
    ) != 'task'
  BEGIN
    SELECT RAISE(ABORT, 'Subtask parent must be a task');
  END;

  CREATE TRIGGER validate_subtask_parent_on_update
  BEFORE UPDATE OF kind, parent_task_id ON task_items
  WHEN NEW.kind = 'subtask'
    AND COALESCE(
      (SELECT kind FROM task_items WHERE id = NEW.parent_task_id AND deleted_at IS NULL),
      ''
    ) != 'task'
  BEGIN
    SELECT RAISE(ABORT, 'Subtask parent must be a task');
  END;
`;

const schemaVersionSeven = `
  ALTER TABLE schedule_blocks ADD COLUMN occurrence_id TEXT;
  ALTER TABLE schedule_blocks ADD COLUMN time_zone_id TEXT;

  CREATE TABLE recurrence_series_v7 (
    id TEXT PRIMARY KEY,
    item_kind TEXT NOT NULL CHECK (item_kind IN ('task', 'reminder')),
    item_id TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    interval INTEGER NOT NULL CHECK (interval > 0),
    starts_on TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT
  );

  INSERT INTO recurrence_series_v7 (
    id, item_kind, item_id, frequency, interval, starts_on, created_at, updated_at, deleted_at
  )
  SELECT id, 'task', task_item_id, frequency, interval, starts_on, created_at, updated_at, deleted_at
  FROM recurrence_series;

  DROP TABLE recurrence_series;
  ALTER TABLE recurrence_series_v7 RENAME TO recurrence_series;
  CREATE INDEX recurrence_series_live_owner ON recurrence_series (item_kind, item_id)
    WHERE deleted_at IS NULL;

  CREATE TABLE recurrence_occurrences (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL REFERENCES recurrence_series(id),
    occurs_on TEXT NOT NULL,
    cancelled_at TEXT,
    completed_at TEXT,
    blocks_overridden INTEGER NOT NULL DEFAULT 0 CHECK (blocks_overridden IN (0, 1)),
    task_patch TEXT,
    reminder_patch TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE UNIQUE INDEX recurrence_occurrences_live_series_date
    ON recurrence_occurrences (series_id, occurs_on)
    WHERE deleted_at IS NULL;
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
  {
    version: 3,
    async apply(database) {
      await database.execAsync(schemaVersionThree);
    },
  },
  {
    version: 4,
    async apply(database) {
      await database.execAsync(schemaVersionFour);
    },
  },
  {
    version: 5,
    async apply(database) {
      await database.execAsync(schemaVersionFive);
    },
  },
  {
    version: 6,
    async apply(database) {
      await database.execAsync(schemaVersionSix);
    },
  },
  {
    version: 7,
    async apply(database) {
      await database.execAsync(schemaVersionSeven);
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
