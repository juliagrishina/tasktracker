import * as SQLite from 'expo-sqlite';

import type {
  AppSettings,
  CompletedItem,
  EntityId,
  Project,
  RecurrenceOccurrence,
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
}

interface TaskItemRow {
  id: string;
  kind: 'task' | 'subtask';
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  scheduled_on: string | null;
  period_start_on: string | null;
  period_end_on: string | null;
  estimated_duration_minutes: number | null;
  completed_at: string | null;
  created_at: string;
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
}

interface ScheduleBlockRow {
  id: string;
  task_item_id: string;
  occurrence_id: string | null;
  starts_at: string;
  ends_at: string;
  created_at: string;
}

interface RecurrenceSeriesRow {
  id: string;
  item_kind: RecurrenceSeries['itemKind'];
  item_id: string;
  frequency: RecurrenceSeries['frequency'];
  interval: number;
  starts_on: string;
  created_at: string;
}

interface RecurrenceOccurrenceRow {
  id: string;
  series_id: string;
  occurs_on: string;
  status: RecurrenceOccurrence['status'];
  task_patch: string | null;
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
      `INSERT INTO projects (id, title, description, completed_at, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        completed_at = excluded.completed_at,
        created_at = excluded.created_at`,
      [
        project.id,
        project.title,
        project.description,
        project.completedAt,
        project.createdAt,
      ],
    );
  }

  async getProject(id: EntityId): Promise<Project | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<ProjectRow>(
      `SELECT id, title, description, completed_at, created_at
      FROM projects WHERE id = ?`,
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
        };
  }

  async listProjects(): Promise<readonly Project[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<ProjectRow>(
      `SELECT id, title, description, completed_at, created_at
      FROM projects
      ORDER BY created_at ASC, id ASC`,
    );

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    }));
  }

  async deleteProject(id: EntityId): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync('DELETE FROM projects WHERE id = ?', [id]);
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
        description,
        scheduled_on,
        period_start_on,
        period_end_on,
        estimated_duration_minutes,
        completed_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind,
        project_id = excluded.project_id,
        parent_task_id = excluded.parent_task_id,
        title = excluded.title,
        description = excluded.description,
        scheduled_on = excluded.scheduled_on,
        period_start_on = excluded.period_start_on,
        period_end_on = excluded.period_end_on,
        estimated_duration_minutes = excluded.estimated_duration_minutes,
        completed_at = excluded.completed_at,
        created_at = excluded.created_at`,
      [
        task.id,
        task.kind,
        task.projectId,
        task.parentTaskId,
        task.title,
        task.description,
        task.scheduledOn,
        task.periodStartOn,
        task.periodEndOn,
        task.estimatedDurationMinutes,
        task.completedAt,
        task.createdAt,
      ],
    );
  }

  async getTaskItem(id: EntityId): Promise<TaskItem | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<TaskItemRow>(
      `SELECT id, kind, project_id, parent_task_id, title, description,
        scheduled_on, period_start_on, period_end_on, estimated_duration_minutes, completed_at, created_at
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
        description: row.description,
        scheduledOn: row.scheduled_on,
        periodStartOn: row.period_start_on,
        periodEndOn: row.period_end_on,
        estimatedDurationMinutes: row.estimated_duration_minutes,
        completedAt: row.completed_at,
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
      description: row.description,
      scheduledOn: row.scheduled_on,
      periodStartOn: row.period_start_on,
      periodEndOn: row.period_end_on,
      estimatedDurationMinutes: row.estimated_duration_minutes,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }

  async listTaskItems(): Promise<readonly TaskItem[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<TaskItemRow>(
      `SELECT id, kind, project_id, parent_task_id, title, description,
        scheduled_on, period_start_on, period_end_on, estimated_duration_minutes, completed_at, created_at
      FROM task_items
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
          scheduledOn: row.scheduled_on,
          periodStartOn: row.period_start_on,
          periodEndOn: row.period_end_on,
          estimatedDurationMinutes: row.estimated_duration_minutes,
          completedAt: row.completed_at,
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
        description: row.description,
        scheduledOn: row.scheduled_on,
        periodStartOn: row.period_start_on,
        periodEndOn: row.period_end_on,
        estimatedDurationMinutes: row.estimated_duration_minutes,
        completedAt: row.completed_at,
        createdAt: row.created_at,
      };
    });
  }

  async deleteTaskItem(id: EntityId): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync(
      `DELETE FROM recurrence_series
      WHERE item_kind = 'task'
        AND item_id IN (
          SELECT id FROM task_items WHERE id = ? OR parent_task_id = ?
        )`,
      [id, id],
    );
    await database.runAsync('DELETE FROM task_items WHERE id = ?', [id]);
  }

  async saveReminder(reminder: Reminder): Promise<void> {
    await this.initialize();
    assertReminderShape(reminder);
    const database = await this.getDatabase();
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
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        reminds_on = excluded.reminds_on,
        period_start_on = excluded.period_start_on,
        period_end_on = excluded.period_end_on,
        repeat_frequency = excluded.repeat_frequency,
        repeat_interval = excluded.repeat_interval,
        estimated_duration_minutes = excluded.estimated_duration_minutes,
        completed_at = excluded.completed_at,
        created_at = excluded.created_at`,
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
      ],
    );
  }

  async getReminder(id: EntityId): Promise<Reminder | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<ReminderRow>(
      `SELECT id, title, reminds_on, period_start_on, period_end_on,
        repeat_frequency, repeat_interval, estimated_duration_minutes, completed_at, created_at
      FROM reminders
      WHERE id = ?`,
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
        };
  }

  async listReminders(): Promise<readonly Reminder[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<ReminderRow>(
      `SELECT id, title, reminds_on, period_start_on, period_end_on,
        repeat_frequency, repeat_interval, estimated_duration_minutes, completed_at, created_at
      FROM reminders
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
    }));
  }

  async deleteReminder(id: EntityId): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync(
      `DELETE FROM recurrence_series WHERE item_kind = 'reminder' AND item_id = ?`,
      [id],
    );
    await database.runAsync('DELETE FROM reminders WHERE id = ?', [id]);
  }

  async saveScheduleBlock(block: ScheduleBlock): Promise<void> {
    await this.initialize();
    const task = await this.getTaskItem(block.taskItemId);

    if (task === null) {
      throw new Error('Задача для блока расписания не найдена');
    }

    if (block.occurrenceId !== null) {
      const occurrence = await this.getRecurrenceOccurrence(block.occurrenceId);
      if (occurrence === null) {
        throw new Error('Экземпляр повторения для блока не найден');
      }
    }

    assertScheduleBlockShape(block, task);
    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT INTO schedule_blocks (id, task_item_id, occurrence_id, starts_at, ends_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_item_id = excluded.task_item_id,
        occurrence_id = excluded.occurrence_id,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        created_at = excluded.created_at`,
      [block.id, block.taskItemId, block.occurrenceId, block.startsAt, block.endsAt, block.createdAt],
    );
  }

  async getScheduleBlock(id: EntityId): Promise<ScheduleBlock | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<ScheduleBlockRow>(
      `SELECT id, task_item_id, occurrence_id, starts_at, ends_at, created_at
      FROM schedule_blocks
      WHERE id = ?`,
      [id],
    );

    return row === null
      ? null
      : {
          id: row.id,
          taskItemId: row.task_item_id,
          occurrenceId: row.occurrence_id,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          createdAt: row.created_at,
        };
  }

  async listScheduleBlocks(): Promise<readonly ScheduleBlock[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<ScheduleBlockRow>(
      `SELECT id, task_item_id, occurrence_id, starts_at, ends_at, created_at
      FROM schedule_blocks
      ORDER BY created_at ASC, id ASC`,
    );

    return rows.map((row) => ({
      id: row.id,
      taskItemId: row.task_item_id,
      occurrenceId: row.occurrence_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdAt: row.created_at,
    }));
  }

  async listScheduleBlocksForTaskItem(taskItemId: EntityId): Promise<readonly ScheduleBlock[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<ScheduleBlockRow>(
      `SELECT id, task_item_id, occurrence_id, starts_at, ends_at, created_at
      FROM schedule_blocks
      WHERE task_item_id = ?
      ORDER BY created_at ASC, id ASC`,
      [taskItemId],
    );

    return rows.map((row) => ({
      id: row.id,
      taskItemId: row.task_item_id,
      occurrenceId: row.occurrence_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdAt: row.created_at,
    }));
  }

  async deleteScheduleBlock(id: EntityId): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync('DELETE FROM schedule_blocks WHERE id = ?', [id]);
  }

  async saveRecurrenceSeries(series: RecurrenceSeries): Promise<void> {
    await this.initialize();
    const planningItem = series.itemKind === 'task'
      ? await this.getTaskItem(series.itemId)
      : await this.getReminder(series.itemId);

    if (planningItem === null) {
      throw new Error('Элемент планирования не найден');
    }

    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT INTO recurrence_series (
        id,
        item_kind,
        item_id,
        frequency,
        interval,
        starts_on,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        item_kind = excluded.item_kind,
        item_id = excluded.item_id,
        frequency = excluded.frequency,
        interval = excluded.interval,
        starts_on = excluded.starts_on,
        created_at = excluded.created_at`,
      [
        series.id,
        series.itemKind,
        series.itemId,
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
      `SELECT id, item_kind, item_id, frequency, interval, starts_on, created_at
      FROM recurrence_series
      WHERE id = ?`,
      [id],
    );

    return row === null
      ? null
      : {
          id: row.id,
          itemKind: row.item_kind,
          itemId: row.item_id,
          frequency: row.frequency,
          interval: row.interval,
          startsOn: row.starts_on,
          createdAt: row.created_at,
        };
  }

  async listRecurrenceSeries(): Promise<readonly RecurrenceSeries[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<RecurrenceSeriesRow>(
      `SELECT id, item_kind, item_id, frequency, interval, starts_on, created_at
      FROM recurrence_series
      ORDER BY created_at ASC, id ASC`,
    );

    return rows.map((row) => ({
      id: row.id,
      itemKind: row.item_kind,
      itemId: row.item_id,
      frequency: row.frequency,
      interval: row.interval,
      startsOn: row.starts_on,
      createdAt: row.created_at,
    }));
  }

  async deleteRecurrenceSeries(id: EntityId): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync('DELETE FROM recurrence_series WHERE id = ?', [id]);
  }

  async saveRecurrenceOccurrence(occurrence: RecurrenceOccurrence): Promise<void> {
    await this.initialize();
    const series = await this.getRecurrenceSeries(occurrence.seriesId);
    if (series === null) {
      throw new Error('Серия повторений для экземпляра не найдена');
    }

    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT INTO recurrence_occurrences (id, series_id, occurs_on, status, task_patch, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        series_id = excluded.series_id,
        occurs_on = excluded.occurs_on,
        status = excluded.status,
        task_patch = excluded.task_patch,
        created_at = excluded.created_at`,
      [
        occurrence.id,
        occurrence.seriesId,
        occurrence.occursOn,
        occurrence.status,
        occurrence.taskPatch === undefined ? null : JSON.stringify(occurrence.taskPatch),
        occurrence.createdAt,
      ],
    );
  }

  async getRecurrenceOccurrence(id: EntityId): Promise<RecurrenceOccurrence | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<RecurrenceOccurrenceRow>(
      `SELECT id, series_id, occurs_on, status, task_patch, created_at
      FROM recurrence_occurrences
      WHERE id = ?`,
      [id],
    );

    return row === null
      ? null
      : {
          id: row.id,
          seriesId: row.series_id,
          occursOn: row.occurs_on,
          status: row.status,
          ...(row.task_patch === null ? {} : { taskPatch: JSON.parse(row.task_patch) }),
          createdAt: row.created_at,
        };
  }

  async listRecurrenceOccurrences(): Promise<readonly RecurrenceOccurrence[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<RecurrenceOccurrenceRow>(
      `SELECT id, series_id, occurs_on, status, task_patch, created_at
      FROM recurrence_occurrences
      ORDER BY created_at ASC, id ASC`,
    );

    return rows.map((row) => ({
      id: row.id,
      seriesId: row.series_id,
      occursOn: row.occurs_on,
      status: row.status,
      ...(row.task_patch === null ? {} : { taskPatch: JSON.parse(row.task_patch) }),
      createdAt: row.created_at,
    }));
  }

  async deleteRecurrenceOccurrence(id: EntityId): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync('DELETE FROM recurrence_occurrences WHERE id = ?', [id]);
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
