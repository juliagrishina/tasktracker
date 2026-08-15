import * as SQLite from 'expo-sqlite';

import type {
  AppSettings,
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
  description: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface TaskItemRow {
  id: string;
  kind: 'task' | 'subtask';
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  estimated_duration_minutes: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface ReminderRow {
  id: string;
  title: string;
  reminds_on: string | null;
  period_start_on: string | null;
  period_end_on: string | null;
  repeat_frequency: NonNullable<Reminder['repeatRule']>['frequency'] | null;
  repeat_interval: number | null;
  estimated_duration_minutes: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface ScheduleBlockRow {
  id: string;
  task_item_id: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string | null;
}

interface RecurrenceSeriesRow {
  id: string;
  task_item_id: string;
  frequency: RecurrenceSeries['frequency'];
  interval: number;
  starts_on: string;
  created_at: string;
  updated_at: string | null;
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
    const updatedAt = new Date().toISOString();
    await database.runAsync(
      `INSERT INTO projects (id, title, description, completed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        completed_at = excluded.completed_at,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
      [
        project.id,
        project.title,
        project.description,
        project.completedAt,
        project.createdAt,
        updatedAt,
      ],
    );
  }

  async getProject(id: EntityId): Promise<Project | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<ProjectRow>(
      `SELECT id, title, description, completed_at, created_at, updated_at
      FROM projects WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );

    return row === null
      ? null
      : {
          id: row.id,
          title: row.title,
          description: row.description,
          completedAt: row.completed_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at ?? row.created_at,
          deletedAt: null,
        };
  }

  async listProjects(): Promise<readonly Project[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<ProjectRow>(
      `SELECT id, title, description, completed_at, created_at, updated_at
      FROM projects
      WHERE deleted_at IS NULL
      ORDER BY created_at ASC, id ASC`,
    );

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
      deletedAt: null,
    }));
  }

  async deleteProject(id: EntityId): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    const deletedAt = new Date().toISOString();
    await database.runAsync(
      'UPDATE task_items SET project_id = NULL, updated_at = ? WHERE project_id = ?',
      [deletedAt, id],
    );
    await database.runAsync(
      'UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [deletedAt, deletedAt, id],
    );
  }

  async saveTaskItem(task: TaskItem): Promise<void> {
    await this.initialize();
    const parent =
      task.kind === 'subtask'
        ? await this.getTaskItem(task.parentTaskId)
        : null;
    assertTaskItemParent(task, parent);

    const database = await this.getDatabase();
    const updatedAt = new Date().toISOString();
    await database.runAsync(
      `INSERT INTO task_items (
        id,
        kind,
        project_id,
        parent_task_id,
        title,
        description,
        estimated_duration_minutes,
        completed_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind,
        project_id = excluded.project_id,
        parent_task_id = excluded.parent_task_id,
        title = excluded.title,
        description = excluded.description,
        estimated_duration_minutes = excluded.estimated_duration_minutes,
        completed_at = excluded.completed_at,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
      [
        task.id,
        task.kind,
        task.projectId,
        task.parentTaskId,
        task.title,
        task.description,
        task.estimatedDurationMinutes,
        task.completedAt,
        task.createdAt,
        updatedAt,
      ],
    );
  }

  async getTaskItem(id: EntityId): Promise<TaskItem | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<TaskItemRow>(
      `SELECT id, kind, project_id, parent_task_id, title, description,
        estimated_duration_minutes, completed_at, created_at, updated_at
      FROM task_items
      WHERE id = ? AND deleted_at IS NULL`,
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
        description: row.description,
        estimatedDurationMinutes: row.estimated_duration_minutes,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? row.created_at,
        deletedAt: null,
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
      description: row.description,
      estimatedDurationMinutes: row.estimated_duration_minutes,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
      deletedAt: null,
    };
  }

  async listTaskItems(): Promise<readonly TaskItem[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<TaskItemRow>(
      `SELECT id, kind, project_id, parent_task_id, title, description,
        estimated_duration_minutes, completed_at, created_at, updated_at
      FROM task_items
      WHERE deleted_at IS NULL
      ORDER BY created_at ASC, id ASC`,
    );

    return rows.map((row) => {
      if (row.kind === 'task') {
        return {
          id: row.id,
          kind: 'task',
          projectId: row.project_id,
          parentTaskId: null,
          title: row.title,
          description: row.description,
          estimatedDurationMinutes: row.estimated_duration_minutes,
          completedAt: row.completed_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at ?? row.created_at,
          deletedAt: null,
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
        description: row.description,
        estimatedDurationMinutes: row.estimated_duration_minutes,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? row.created_at,
        deletedAt: null,
      };
    });
  }

  async deleteTaskItem(id: EntityId): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    const deletedAt = new Date().toISOString();
    await database.runAsync(
      `DELETE FROM schedule_blocks
      WHERE task_item_id = ?
        OR task_item_id IN (SELECT id FROM task_items WHERE parent_task_id = ?)`,
      [id, id],
    );
    await database.runAsync(
      `DELETE FROM recurrence_series
      WHERE task_item_id = ?
        OR task_item_id IN (SELECT id FROM task_items WHERE parent_task_id = ?)`,
      [id, id],
    );
    await database.runAsync(
      'UPDATE task_items SET deleted_at = ?, updated_at = ? WHERE id = ? OR parent_task_id = ?',
      [deletedAt, deletedAt, id, id],
    );
  }

  async saveReminder(reminder: Reminder): Promise<void> {
    await this.initialize();
    assertReminderShape(reminder);
    const database = await this.getDatabase();
    const updatedAt = new Date().toISOString();
    await database.runAsync(
      `INSERT INTO reminders (
        id,
        title,
        reminds_on,
        period_start_on,
        period_end_on,
        repeat_frequency,
        repeat_interval,
        estimated_duration_minutes,
        completed_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        reminds_on = excluded.reminds_on,
        period_start_on = excluded.period_start_on,
        period_end_on = excluded.period_end_on,
        repeat_frequency = excluded.repeat_frequency,
        repeat_interval = excluded.repeat_interval,
        estimated_duration_minutes = excluded.estimated_duration_minutes,
        completed_at = excluded.completed_at,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
      [
        reminder.id,
        reminder.title,
        reminder.remindsOn,
        reminder.periodStartOn,
        reminder.periodEndOn,
        reminder.repeatRule?.frequency ?? null,
        reminder.repeatRule?.interval ?? null,
        reminder.estimatedDurationMinutes,
        reminder.completedAt,
        reminder.createdAt,
        updatedAt,
      ],
    );
  }

  async getReminder(id: EntityId): Promise<Reminder | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<ReminderRow>(
      `SELECT id, title, reminds_on, period_start_on, period_end_on,
        repeat_frequency, repeat_interval, estimated_duration_minutes, completed_at, created_at, updated_at
      FROM reminders
      WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );

    return row === null
      ? null
      : {
          id: row.id,
          title: row.title,
          remindsOn: row.reminds_on,
          periodStartOn: row.period_start_on,
          periodEndOn: row.period_end_on,
          repeatRule:
            row.repeat_frequency === null || row.repeat_interval === null
              ? null
              : { frequency: row.repeat_frequency, interval: row.repeat_interval },
          estimatedDurationMinutes: row.estimated_duration_minutes,
          completedAt: row.completed_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at ?? row.created_at,
          deletedAt: null,
        };
  }

  async listReminders(): Promise<readonly Reminder[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<ReminderRow>(
      `SELECT id, title, reminds_on, period_start_on, period_end_on,
        repeat_frequency, repeat_interval, estimated_duration_minutes, completed_at, created_at, updated_at
      FROM reminders
      WHERE deleted_at IS NULL
      ORDER BY created_at ASC, id ASC`,
    );

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      remindsOn: row.reminds_on,
      periodStartOn: row.period_start_on,
      periodEndOn: row.period_end_on,
      repeatRule:
        row.repeat_frequency === null || row.repeat_interval === null
          ? null
          : { frequency: row.repeat_frequency, interval: row.repeat_interval },
      estimatedDurationMinutes: row.estimated_duration_minutes,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
      deletedAt: null,
    }));
  }

  async deleteReminder(id: EntityId): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    const deletedAt = new Date().toISOString();
    await database.runAsync(
      'UPDATE reminders SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [deletedAt, deletedAt, id],
    );
  }

  async saveScheduleBlock(block: ScheduleBlock): Promise<void> {
    await this.initialize();
    const task = await this.getTaskItem(block.taskItemId);

    if (task === null) {
      throw new Error('Задача для блока расписания не найдена');
    }

    assertScheduleBlockShape(block, task);
    const database = await this.getDatabase();
    const updatedAt = new Date().toISOString();
    await database.runAsync(
      `INSERT INTO schedule_blocks (id, task_item_id, starts_at, ends_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_item_id = excluded.task_item_id,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
      [block.id, block.taskItemId, block.startsAt, block.endsAt, block.createdAt, updatedAt],
    );
  }

  async getScheduleBlock(id: EntityId): Promise<ScheduleBlock | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<ScheduleBlockRow>(
      `SELECT id, task_item_id, starts_at, ends_at, created_at, updated_at
      FROM schedule_blocks
      WHERE id = ? AND deleted_at IS NULL`,
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
          updatedAt: row.updated_at ?? row.created_at,
          deletedAt: null,
        };
  }

  async listScheduleBlocks(): Promise<readonly ScheduleBlock[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<ScheduleBlockRow>(
      `SELECT id, task_item_id, starts_at, ends_at, created_at, updated_at
      FROM schedule_blocks
      WHERE deleted_at IS NULL
      ORDER BY created_at ASC, id ASC`,
    );

    return rows.map((row) => ({
      id: row.id,
      taskItemId: row.task_item_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
      deletedAt: null,
    }));
  }

  async saveRecurrenceSeries(series: RecurrenceSeries): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    const updatedAt = new Date().toISOString();
    await database.runAsync(
      `INSERT INTO recurrence_series (
        id,
        task_item_id,
        frequency,
        interval,
        starts_on,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_item_id = excluded.task_item_id,
        frequency = excluded.frequency,
        interval = excluded.interval,
        starts_on = excluded.starts_on,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
      [
        series.id,
        series.taskItemId,
        series.frequency,
        series.interval,
        series.startsOn,
        series.createdAt,
        updatedAt,
      ],
    );
  }

  async getRecurrenceSeries(id: EntityId): Promise<RecurrenceSeries | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<RecurrenceSeriesRow>(
      `SELECT id, task_item_id, frequency, interval, starts_on, created_at, updated_at
      FROM recurrence_series
      WHERE id = ? AND deleted_at IS NULL`,
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
          updatedAt: row.updated_at ?? row.created_at,
          deletedAt: null,
        };
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    await this.initialize();
    const database = await this.getDatabase();
    let result: { value: T } | undefined;
    await database.withTransactionAsync(async () => {
      result = { value: await operation() };
    });

    if (result === undefined) {
      throw new Error('Транзакция не вернула результат');
    }

    return result.value;
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
