import * as SQLite from 'expo-sqlite';

import type {
  AppSettings,
  CompletedItem,
  EntityId,
  Project,
  RecurrenceSeries,
  Reminder,
  ScheduleBlock,
  TaskItem,
} from '../domain/entities';
import {
  assertReminderShape,
  assertScheduleBlockShape,
  assertTaskItemParent,
} from '../domain/invariants';

import type { AppDataSource } from './contracts';
import { migrateDatabase } from './migrations';

interface SettingsRow {
  workday_starts_at: string;
  workday_ends_at: string;
  evening_review_at: string;
  notification_lead_minutes: number;
}

interface ProjectRow {
  id: string;
  title: string;
  created_at: string;
}

interface TaskItemRow {
  id: string;
  kind: 'task' | 'subtask';
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  created_at: string;
}

interface ReminderRow {
  id: string;
  title: string;
  task_item_id: string | null;
  project_id: string | null;
  reminds_at: string;
  created_at: string;
}

interface ScheduleBlockRow {
  id: string;
  task_item_id: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
}

interface RecurrenceSeriesRow {
  id: string;
  task_item_id: string;
  frequency: RecurrenceSeries['frequency'];
  interval: number;
  starts_on: string;
  created_at: string;
}

interface CompletedItemRow {
  id: string;
  task_item_id: string;
  completed_at: string;
  created_at: string;
}

class NativeDataSource implements AppDataSource {
  private databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
  private initializationPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initializationPromise === null) {
      this.initializationPromise = this.initializeDatabase();
    }

    await this.initializationPromise;
  }

  async getSettings(): Promise<AppSettings> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<SettingsRow>(
      `SELECT
        workday_starts_at,
        workday_ends_at,
        evening_review_at,
        notification_lead_minutes
      FROM settings
      WHERE id = 1`,
    );

    if (row === null) {
      throw new Error('Не удалось загрузить настройки приложения');
    }

    return {
      workdayStartsAt: row.workday_starts_at,
      workdayEndsAt: row.workday_ends_at,
      eveningReviewAt: row.evening_review_at,
      notificationLeadMinutes: row.notification_lead_minutes,
    };
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync(
      `UPDATE settings
      SET workday_starts_at = ?,
          workday_ends_at = ?,
          evening_review_at = ?,
          notification_lead_minutes = ?
      WHERE id = 1`,
      [
        settings.workdayStartsAt,
        settings.workdayEndsAt,
        settings.eveningReviewAt,
        settings.notificationLeadMinutes,
      ],
    );
  }

  async saveProject(project: Project): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT INTO projects (id, title, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        created_at = excluded.created_at`,
      [project.id, project.title, project.createdAt],
    );
  }

  async getProject(id: EntityId): Promise<Project | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<ProjectRow>(
      'SELECT id, title, created_at FROM projects WHERE id = ?',
      [id],
    );

    return row === null
      ? null
      : {
          id: row.id,
          title: row.title,
          description: null,
          completedAt: null,
          createdAt: row.created_at,
        };
  }

  async saveTaskItem(task: TaskItem): Promise<void> {
    await this.initialize();
    const parent =
      task.kind === 'subtask'
        ? await this.getTaskItem(task.parentTaskId)
        : null;
    assertTaskItemParent(task, parent);

    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT INTO task_items (
        id,
        kind,
        project_id,
        parent_task_id,
        title,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind,
        project_id = excluded.project_id,
        parent_task_id = excluded.parent_task_id,
        title = excluded.title,
        created_at = excluded.created_at`,
      [
        task.id,
        task.kind,
        task.projectId,
        task.parentTaskId,
        task.title,
        task.createdAt,
      ],
    );
  }

  async getTaskItem(id: EntityId): Promise<TaskItem | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<TaskItemRow>(
      `SELECT id, kind, project_id, parent_task_id, title, created_at
      FROM task_items
      WHERE id = ?`,
      [id],
    );

    if (row === null) {
      return null;
    }

    if (row.kind === 'task') {
      return {
        id: row.id,
        kind: 'task',
        projectId: row.project_id,
        parentTaskId: null,
        title: row.title,
        description: null,
        estimatedDurationMinutes: null,
        completedAt: null,
        createdAt: row.created_at,
      };
    }

    if (row.parent_task_id === null) {
      throw new Error('В хранилище обнаружена подзадача без родителя');
    }

    return {
      id: row.id,
      kind: 'subtask',
      projectId: row.project_id,
      parentTaskId: row.parent_task_id,
      title: row.title,
      description: null,
      estimatedDurationMinutes: null,
      completedAt: null,
      createdAt: row.created_at,
    };
  }

  async saveReminder(reminder: Reminder): Promise<void> {
    await this.initialize();
    assertReminderShape(reminder);
    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT INTO reminders (
        id,
        title,
        task_item_id,
        project_id,
        reminds_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        task_item_id = excluded.task_item_id,
        project_id = excluded.project_id,
        reminds_at = excluded.reminds_at,
        created_at = excluded.created_at`,
      [
        reminder.id,
        reminder.title,
        null,
        null,
        reminder.remindsOn ?? reminder.createdAt.slice(0, 10),
        reminder.createdAt,
      ],
    );
  }

  async getReminder(id: EntityId): Promise<Reminder | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<ReminderRow>(
      `SELECT id, title, task_item_id, project_id, reminds_at, created_at
      FROM reminders
      WHERE id = ?`,
      [id],
    );

    return row === null
      ? null
      : {
          id: row.id,
          title: row.title,
          remindsOn: row.reminds_at.slice(0, 10),
          periodStartOn: null,
          periodEndOn: null,
          repeatRule: null,
          estimatedDurationMinutes: null,
          completedAt: null,
          createdAt: row.created_at,
        };
  }

  async deleteReminder(id: EntityId): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync('DELETE FROM reminders WHERE id = ?', [id]);
  }

  async saveScheduleBlock(block: ScheduleBlock): Promise<void> {
    await this.initialize();
    const task = await this.getTaskItem(block.taskItemId);

    if (task === null) {
      throw new Error('Задача для блока расписания не найдена');
    }

    assertScheduleBlockShape(block, task);
    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT INTO schedule_blocks (id, task_item_id, starts_at, ends_at, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_item_id = excluded.task_item_id,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        created_at = excluded.created_at`,
      [block.id, block.taskItemId, block.startsAt, block.endsAt, block.createdAt],
    );
  }

  async getScheduleBlock(id: EntityId): Promise<ScheduleBlock | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<ScheduleBlockRow>(
      `SELECT id, task_item_id, starts_at, ends_at, created_at
      FROM schedule_blocks
      WHERE id = ?`,
      [id],
    );

    return row === null
      ? null
      : {
          id: row.id,
          taskItemId: row.task_item_id,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          createdAt: row.created_at,
        };
  }

  async saveRecurrenceSeries(series: RecurrenceSeries): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT INTO recurrence_series (
        id,
        task_item_id,
        frequency,
        interval,
        starts_on,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_item_id = excluded.task_item_id,
        frequency = excluded.frequency,
        interval = excluded.interval,
        starts_on = excluded.starts_on,
        created_at = excluded.created_at`,
      [
        series.id,
        series.taskItemId,
        series.frequency,
        series.interval,
        series.startsOn,
        series.createdAt,
      ],
    );
  }

  async getRecurrenceSeries(id: EntityId): Promise<RecurrenceSeries | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<RecurrenceSeriesRow>(
      `SELECT id, task_item_id, frequency, interval, starts_on, created_at
      FROM recurrence_series
      WHERE id = ?`,
      [id],
    );

    return row === null
      ? null
      : {
          id: row.id,
          taskItemId: row.task_item_id,
          frequency: row.frequency,
          interval: row.interval,
          startsOn: row.starts_on,
          createdAt: row.created_at,
        };
  }

  async saveCompletedItem(item: CompletedItem): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT INTO completed_items (id, task_item_id, completed_at, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_item_id = excluded.task_item_id,
        completed_at = excluded.completed_at,
        created_at = excluded.created_at`,
      [item.id, item.taskItemId, item.completedAt, item.createdAt],
    );
  }

  async getCompletedItem(id: EntityId): Promise<CompletedItem | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<CompletedItemRow>(
      `SELECT id, task_item_id, completed_at, created_at
      FROM completed_items
      WHERE id = ?`,
      [id],
    );

    return row === null
      ? null
      : {
          id: row.id,
          taskItemId: row.task_item_id,
          completedAt: row.completed_at,
          createdAt: row.created_at,
        };
  }

  private async initializeDatabase(): Promise<void> {
    const database = await this.getDatabase();
    await migrateDatabase(database);
  }

  private getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (this.databasePromise === null) {
      this.databasePromise = SQLite.openDatabaseAsync('tasktracker.db');
    }

    return this.databasePromise;
  }
}

export function createDataSource(): AppDataSource {
  return new NativeDataSource();
}
