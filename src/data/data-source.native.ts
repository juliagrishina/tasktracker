import * as SQLite from 'expo-sqlite';

import type {
  AppSettings,
  DailyEnergyEntry,
  EntityId,
  Project,
  RecurrenceOccurrence,
  RecurrenceRevision,
  RecurrenceSeries,
  Reminder,
  ScheduleBlock,
  TaskItem,
  TransferHistory,
} from '../domain/entities';
import {
  assertReminderShape,
  assertScheduleBlockShape,
  assertTaskItemParent,
} from '../domain/invariants';

import type { AppDataSource } from './contracts';
import { getDefaultSettings, resolveTimeZoneId } from './default-settings';
import {
  migrateLegacyDatabaseToAutonomousScope,
  type ScopeMigrationDatabase,
} from './local-data-scope-migration';
import { databaseNameForScope, type LocalDataScope } from './local-data-scopes';
import { migrateDatabase } from './migrations';

interface SettingsRow {
  time_zone_id: string | null;
  time_zone_mode: 'device' | 'manual' | null;
  workday_starts_at: string;
  workday_ends_at: string;
  evening_review_at: string;
  evening_review_notification_id: string | null;
  notification_lead_minutes: number;
  completion_prompt_deferred_on: string | null;
}

interface DailyEnergyEntryRow {
  recorded_on: string;
  energy_percent: number | null;
  created_at: string;
  updated_at: string;
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
  scheduled_on: string | null;
  period_start_on: string | null;
  period_end_on: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface ReminderRow {
  id: string;
  title: string;
  linked_task_item_id: string | null;
  linked_occurrence_on: string | null;
  reminds_on: string | null;
  period_start_on: string | null;
  period_end_on: string | null;
  repeat_frequency: NonNullable<Reminder['repeatRule']>['frequency'] | null;
  repeat_interval: number | null;
  repeat_weekdays_json: string | null;
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
  occurrence_id: string | null;
  notification_id: string | null;
  time_zone_id: string | null;
  created_at: string;
  updated_at: string | null;
}

interface RecurrenceSeriesRow {
  id: string;
  item_kind: RecurrenceSeries['itemKind'];
  item_id: string;
  frequency: RecurrenceSeries['frequency'];
  interval: number;
  weekdays_json: string | null;
  starts_on: string;
  created_at: string;
  updated_at: string | null;
}

interface TransferHistoryRow {
  id: string;
  task_item_id: string;
  reason: string | null;
  returned_at: string;
  created_at: string;
}

interface RecurrenceOccurrenceRow {
  id: string;
  series_id: string;
  occurs_on: string;
  cancelled_at: string | null;
  completed_at: string | null;
  blocks_overridden: number;
  task_patch: string | null;
  reminder_patch: string | null;
  notification_ids_json: string | null;
  created_at: string;
  updated_at: string | null;
}

interface RecurrenceRevisionRow {
  id: string;
  series_id: string;
  effective_from: string;
  frequency: RecurrenceRevision['frequency'];
  interval: number;
  weekdays_json: string | null;
  task_patch_json: string;
  block_templates_json: string;
  created_at: string;
  updated_at: string | null;
}

class NativeDataSource implements AppDataSource {
  private databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor(private readonly scope: LocalDataScope) {}

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
        time_zone_id,
        time_zone_mode,
        workday_starts_at,
        workday_ends_at,
        evening_review_at,
        evening_review_notification_id,
        notification_lead_minutes,
        completion_prompt_deferred_on
      FROM settings
      WHERE id = 1`,
    );

    if (row === null) {
      throw new Error('Не удалось загрузить настройки приложения');
    }

    const settings: AppSettings = {
      timeZoneId: row.time_zone_id ?? getDefaultSettings().timeZoneId,
      timeZoneMode: row.time_zone_mode === 'manual' ? 'manual' : 'device',
      workdayStartsAt: row.workday_starts_at,
      workdayEndsAt: row.workday_ends_at,
      eveningReviewAt: row.evening_review_at,
      eveningReviewNotificationId: row.evening_review_notification_id,
      notificationLeadMinutes: row.notification_lead_minutes,
      completionPromptDeferredOn: row.completion_prompt_deferred_on,
    };

    return { ...settings, timeZoneId: resolveTimeZoneId(settings) };
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync(
      `UPDATE settings
      SET time_zone_id = ?,
          time_zone_mode = ?,
          workday_starts_at = ?,
          workday_ends_at = ?,
          evening_review_at = ?,
          evening_review_notification_id = ?,
          notification_lead_minutes = ?,
          completion_prompt_deferred_on = ?
      WHERE id = 1`,
      [
        settings.timeZoneId,
        settings.timeZoneMode ?? 'device',
        settings.workdayStartsAt,
        settings.workdayEndsAt,
        settings.eveningReviewAt,
        settings.eveningReviewNotificationId ?? null,
        settings.notificationLeadMinutes,
        settings.completionPromptDeferredOn ?? null,
      ],
    );
  }

  async getDailyEnergyEntry(recordedOn: string): Promise<DailyEnergyEntry | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<DailyEnergyEntryRow>(
      `SELECT recorded_on, energy_percent, created_at, updated_at
      FROM daily_energy_entries
      WHERE recorded_on = ?`,
      [recordedOn],
    );

    return row === null
      ? null
      : {
          recordedOn: row.recorded_on,
          energyPercent: row.energy_percent,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
  }

  async listDailyEnergyEntries(): Promise<readonly DailyEnergyEntry[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<DailyEnergyEntryRow>(
      `SELECT recorded_on, energy_percent, created_at, updated_at
      FROM daily_energy_entries
      ORDER BY recorded_on ASC`,
    );
    return rows.map((row) => ({
      recordedOn: row.recorded_on,
      energyPercent: row.energy_percent,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async saveDailyEnergyEntry(entry: DailyEnergyEntry): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT INTO daily_energy_entries (recorded_on, energy_percent, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(recorded_on) DO UPDATE SET
        energy_percent = excluded.energy_percent,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
      [entry.recordedOn, entry.energyPercent, entry.createdAt, entry.updatedAt],
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
        scheduled_on,
        period_start_on,
        period_end_on,
        completed_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind,
        project_id = excluded.project_id,
        parent_task_id = excluded.parent_task_id,
        title = excluded.title,
        description = excluded.description,
        estimated_duration_minutes = excluded.estimated_duration_minutes,
        scheduled_on = excluded.scheduled_on,
        period_start_on = excluded.period_start_on,
        period_end_on = excluded.period_end_on,
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
        task.scheduledOn ?? null,
        task.periodStartOn ?? null,
        task.periodEndOn ?? null,
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
        estimated_duration_minutes, scheduled_on, period_start_on, period_end_on,
        completed_at, created_at, updated_at
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
        scheduledOn: row.scheduled_on,
        periodStartOn: row.period_start_on,
        periodEndOn: row.period_end_on,
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
      scheduledOn: row.scheduled_on,
      periodStartOn: row.period_start_on,
      periodEndOn: row.period_end_on,
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
        estimated_duration_minutes, scheduled_on, period_start_on, period_end_on,
        completed_at, created_at, updated_at
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
          scheduledOn: row.scheduled_on,
          periodStartOn: row.period_start_on,
          periodEndOn: row.period_end_on,
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
        scheduledOn: row.scheduled_on,
        periodStartOn: row.period_start_on,
        periodEndOn: row.period_end_on,
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
      `UPDATE schedule_blocks SET deleted_at = ?, updated_at = ?
      WHERE task_item_id = ?
        OR task_item_id IN (SELECT id FROM task_items WHERE parent_task_id = ?)`,
      [deletedAt, deletedAt, id, id],
    );
    await database.runAsync(
      `UPDATE recurrence_occurrences SET deleted_at = ?, updated_at = ?
      WHERE series_id IN (
        SELECT id FROM recurrence_series
        WHERE item_kind = 'task'
          AND (item_id = ? OR item_id IN (SELECT id FROM task_items WHERE parent_task_id = ?))
      )`,
      [deletedAt, deletedAt, id, id],
    );
    await database.runAsync(
      `UPDATE recurrence_series SET deleted_at = ?, updated_at = ?
      WHERE item_kind = 'task'
        AND (item_id = ? OR item_id IN (SELECT id FROM task_items WHERE parent_task_id = ?))`,
      [deletedAt, deletedAt, id, id],
    );
    await database.runAsync(
      'UPDATE task_items SET deleted_at = ?, updated_at = ? WHERE id = ? OR parent_task_id = ?',
      [deletedAt, deletedAt, id, id],
    );
  }

  async saveTransferHistory(history: TransferHistory): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT INTO transfer_history (id, task_item_id, reason, returned_at, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         task_item_id = excluded.task_item_id,
         reason = excluded.reason,
         returned_at = excluded.returned_at,
         created_at = excluded.created_at`,
      [history.id, history.taskItemId, history.reason, history.returnedAt, history.createdAt],
    );
  }

  async listTransferHistories(taskItemId?: EntityId): Promise<readonly TransferHistory[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<TransferHistoryRow>(
      taskItemId === undefined
        ? 'SELECT id, task_item_id, reason, returned_at, created_at FROM transfer_history ORDER BY returned_at ASC, id ASC'
        : 'SELECT id, task_item_id, reason, returned_at, created_at FROM transfer_history WHERE task_item_id = ? ORDER BY returned_at ASC, id ASC',
      taskItemId === undefined ? [] : [taskItemId],
    );
    return rows.map((row) => ({ id: row.id, taskItemId: row.task_item_id, reason: row.reason, returnedAt: row.returned_at, createdAt: row.created_at }));
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
        linked_task_item_id,
        linked_occurrence_on,
        reminds_on,
        period_start_on,
        period_end_on,
        repeat_frequency,
        repeat_interval,
        repeat_weekdays_json,
        estimated_duration_minutes,
        completed_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        linked_task_item_id = excluded.linked_task_item_id,
        linked_occurrence_on = excluded.linked_occurrence_on,
        reminds_on = excluded.reminds_on,
        period_start_on = excluded.period_start_on,
        period_end_on = excluded.period_end_on,
        repeat_frequency = excluded.repeat_frequency,
        repeat_interval = excluded.repeat_interval,
        repeat_weekdays_json = excluded.repeat_weekdays_json,
        estimated_duration_minutes = excluded.estimated_duration_minutes,
        completed_at = excluded.completed_at,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
      [
        reminder.id,
        reminder.title,
        reminder.linkedTaskItemId ?? null,
        reminder.linkedOccurrenceOn ?? null,
        reminder.remindsOn,
        reminder.periodStartOn,
        reminder.periodEndOn,
        reminder.repeatRule?.frequency ?? null,
        reminder.repeatRule?.interval ?? null,
        reminder.repeatRule?.weekdays === undefined ? null : JSON.stringify(reminder.repeatRule.weekdays),
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
      `SELECT id, title, linked_task_item_id, linked_occurrence_on, reminds_on, period_start_on, period_end_on,
        repeat_frequency, repeat_interval, repeat_weekdays_json, estimated_duration_minutes, completed_at, created_at, updated_at
      FROM reminders
      WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );

    return row === null
      ? null
      : {
          id: row.id,
          title: row.title,
          linkedTaskItemId: row.linked_task_item_id,
          linkedOccurrenceOn: row.linked_occurrence_on,
          remindsOn: row.reminds_on,
          periodStartOn: row.period_start_on,
          periodEndOn: row.period_end_on,
          repeatRule:
            row.repeat_frequency === null || row.repeat_interval === null
              ? null
              : { frequency: row.repeat_frequency, interval: row.repeat_interval, weekdays: row.repeat_weekdays_json === null ? undefined : JSON.parse(row.repeat_weekdays_json) },
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
      `SELECT id, title, linked_task_item_id, linked_occurrence_on, reminds_on, period_start_on, period_end_on,
        repeat_frequency, repeat_interval, repeat_weekdays_json, estimated_duration_minutes, completed_at, created_at, updated_at
      FROM reminders
      WHERE deleted_at IS NULL
      ORDER BY created_at ASC, id ASC`,
    );

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      linkedTaskItemId: row.linked_task_item_id,
      linkedOccurrenceOn: row.linked_occurrence_on,
      remindsOn: row.reminds_on,
      periodStartOn: row.period_start_on,
      periodEndOn: row.period_end_on,
      repeatRule:
        row.repeat_frequency === null || row.repeat_interval === null
          ? null
          : { frequency: row.repeat_frequency, interval: row.repeat_interval, weekdays: row.repeat_weekdays_json === null ? undefined : JSON.parse(row.repeat_weekdays_json) },
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
      `UPDATE recurrence_occurrences SET deleted_at = ?, updated_at = ?
      WHERE series_id IN (
        SELECT id FROM recurrence_series WHERE item_kind = 'reminder' AND item_id = ?
      )`,
      [deletedAt, deletedAt, id],
    );
    await database.runAsync(
      `UPDATE recurrence_series SET deleted_at = ?, updated_at = ?
      WHERE item_kind = 'reminder' AND item_id = ?`,
      [deletedAt, deletedAt, id],
    );
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
      `INSERT INTO schedule_blocks (
        id, task_item_id, occurrence_id, notification_id, time_zone_id, starts_at, ends_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_item_id = excluded.task_item_id,
        occurrence_id = excluded.occurrence_id,
        notification_id = excluded.notification_id,
        time_zone_id = excluded.time_zone_id,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
      [
        block.id,
        block.taskItemId,
        block.occurrenceId,
        block.notificationId ?? null,
        block.timeZoneId,
        block.startsAt,
        block.endsAt,
        block.createdAt,
        updatedAt,
      ],
    );
  }

  async getScheduleBlock(id: EntityId): Promise<ScheduleBlock | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<ScheduleBlockRow>(
      `SELECT id, task_item_id, occurrence_id, notification_id, time_zone_id, starts_at, ends_at, created_at, updated_at
      FROM schedule_blocks
      WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );

    return row === null
      ? null
      : {
          id: row.id,
          taskItemId: row.task_item_id,
          occurrenceId: row.occurrence_id,
          notificationId: row.notification_id,
          timeZoneId: row.time_zone_id ?? 'UTC',
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
      `SELECT id, task_item_id, occurrence_id, notification_id, time_zone_id, starts_at, ends_at, created_at, updated_at
      FROM schedule_blocks
      WHERE deleted_at IS NULL
      ORDER BY created_at ASC, id ASC`,
    );

    return rows.map((row) => ({
      id: row.id,
      taskItemId: row.task_item_id,
      occurrenceId: row.occurrence_id,
      notificationId: row.notification_id,
      timeZoneId: row.time_zone_id ?? 'UTC',
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
      deletedAt: null,
    }));
  }

  async listScheduleBlocksForTaskItem(taskItemId: EntityId): Promise<readonly ScheduleBlock[]> {
    const blocks = await this.listScheduleBlocks();
    return blocks.filter((block) => block.taskItemId === taskItemId);
  }

  async deleteScheduleBlock(id: EntityId): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    const deletedAt = new Date().toISOString();
    await database.runAsync(
      'UPDATE schedule_blocks SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [deletedAt, deletedAt, id],
    );
  }

  async saveRecurrenceSeries(series: RecurrenceSeries): Promise<void> {
    await this.initialize();
    if (series.itemKind === 'task') {
      const task = await this.getTaskItem(series.itemId);
      if (task === null) {
        throw new Error('Задача для серии повторения не найдена');
      }
    } else {
      const reminder = await this.getReminder(series.itemId);
      if (reminder === null) {
        throw new Error('Напоминание для серии повторения не найдено');
      }
    }

    const database = await this.getDatabase();
    const updatedAt = new Date().toISOString();
    await database.runAsync(
      `INSERT INTO recurrence_series (
        id,
        item_kind,
        item_id,
        frequency,
        interval,
        weekdays_json,
        starts_on,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        item_kind = excluded.item_kind,
        item_id = excluded.item_id,
        frequency = excluded.frequency,
        interval = excluded.interval,
        weekdays_json = excluded.weekdays_json,
        starts_on = excluded.starts_on,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
      [
        series.id,
        series.itemKind,
        series.itemId,
        series.frequency,
        series.interval,
        series.weekdays === undefined ? null : JSON.stringify(series.weekdays),
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
      `SELECT id, item_kind, item_id, frequency, interval, weekdays_json, starts_on, created_at, updated_at
      FROM recurrence_series
      WHERE id = ? AND deleted_at IS NULL`,
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
          weekdays: row.weekdays_json === null ? undefined : JSON.parse(row.weekdays_json),
          startsOn: row.starts_on,
          createdAt: row.created_at,
          updatedAt: row.updated_at ?? row.created_at,
          deletedAt: null,
        };
  }

  async listRecurrenceSeries(): Promise<readonly RecurrenceSeries[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<RecurrenceSeriesRow>(
      `SELECT id, item_kind, item_id, frequency, interval, weekdays_json, starts_on, created_at, updated_at
      FROM recurrence_series
      WHERE deleted_at IS NULL
      ORDER BY created_at ASC, id ASC`,
    );
    return rows.map((row) => ({
      id: row.id,
      itemKind: row.item_kind,
      itemId: row.item_id,
      frequency: row.frequency,
      interval: row.interval,
      weekdays: row.weekdays_json === null ? undefined : JSON.parse(row.weekdays_json),
      startsOn: row.starts_on,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
      deletedAt: null,
    }));
  }

  async deleteRecurrenceSeries(id: EntityId): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    const deletedAt = new Date().toISOString();
    await database.runAsync(
      `UPDATE schedule_blocks SET deleted_at = ?, updated_at = ?
      WHERE occurrence_id IN (SELECT id FROM recurrence_occurrences WHERE series_id = ?)`,
      [deletedAt, deletedAt, id],
    );
    await database.runAsync(
      'UPDATE recurrence_occurrences SET deleted_at = ?, updated_at = ? WHERE series_id = ?',
      [deletedAt, deletedAt, id],
    );
    await database.runAsync(
      'UPDATE recurrence_series SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [deletedAt, deletedAt, id],
    );
    await database.runAsync(
      'UPDATE recurrence_revisions SET deleted_at = ?, updated_at = ? WHERE series_id = ?',
      [deletedAt, deletedAt, id],
    );
  }

  async saveRecurrenceRevision(revision: RecurrenceRevision): Promise<void> {
    await this.initialize();
    if (await this.getRecurrenceSeries(revision.seriesId) === null) throw new Error('Серия повторения для изменения не найдена');
    const database = await this.getDatabase();
    const updatedAt = new Date().toISOString();
    await database.runAsync(
      `INSERT INTO recurrence_revisions (
        id, series_id, effective_from, frequency, interval, weekdays_json,
        task_patch_json, block_templates_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        series_id = excluded.series_id,
        effective_from = excluded.effective_from,
        frequency = excluded.frequency,
        interval = excluded.interval,
        weekdays_json = excluded.weekdays_json,
        task_patch_json = excluded.task_patch_json,
        block_templates_json = excluded.block_templates_json,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        deleted_at = NULL`,
      [
        revision.id,
        revision.seriesId,
        revision.effectiveFrom,
        revision.frequency,
        revision.interval,
        revision.weekdays === undefined ? null : JSON.stringify(revision.weekdays),
        JSON.stringify(revision.taskPatch),
        JSON.stringify(revision.blockTemplates),
        revision.createdAt,
        updatedAt,
      ],
    );
  }

  async listRecurrenceRevisions(seriesId: EntityId): Promise<readonly RecurrenceRevision[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<RecurrenceRevisionRow>(
      `SELECT id, series_id, effective_from, frequency, interval, weekdays_json,
        task_patch_json, block_templates_json, created_at, updated_at
      FROM recurrence_revisions
      WHERE series_id = ? AND deleted_at IS NULL
      ORDER BY effective_from ASC, created_at ASC, id ASC`,
      [seriesId],
    );
    return rows.map((row) => this.mapRecurrenceRevision(row));
  }

  async deleteRecurrenceRevision(id: EntityId): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    const deletedAt = new Date().toISOString();
    await database.runAsync(
      'UPDATE recurrence_revisions SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [deletedAt, deletedAt, id],
    );
  }

  async saveRecurrenceOccurrence(occurrence: RecurrenceOccurrence): Promise<void> {
    await this.initialize();
    const series = await this.getRecurrenceSeries(occurrence.seriesId);
    if (series === null) {
      throw new Error('Серия повторения для экземпляра не найдена');
    }

    const database = await this.getDatabase();
    const updatedAt = new Date().toISOString();
    await database.runAsync(
      `INSERT INTO recurrence_occurrences (
        id, series_id, occurs_on, cancelled_at, completed_at, blocks_overridden,
        task_patch, reminder_patch, notification_ids_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        series_id = excluded.series_id,
        occurs_on = excluded.occurs_on,
        cancelled_at = excluded.cancelled_at,
        completed_at = excluded.completed_at,
        blocks_overridden = excluded.blocks_overridden,
        task_patch = excluded.task_patch,
        reminder_patch = excluded.reminder_patch,
        notification_ids_json = excluded.notification_ids_json,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
      [
        occurrence.id,
        occurrence.seriesId,
        occurrence.occursOn,
        occurrence.cancelledAt,
        occurrence.completedAt,
        occurrence.blocksOverridden ? 1 : 0,
        occurrence.taskPatch === null ? null : JSON.stringify(occurrence.taskPatch),
        occurrence.reminderPatch === null ? null : JSON.stringify(occurrence.reminderPatch),
        JSON.stringify(occurrence.notificationIds ?? []),
        occurrence.createdAt,
        updatedAt,
      ],
    );
  }

  async getRecurrenceOccurrence(id: EntityId): Promise<RecurrenceOccurrence | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<RecurrenceOccurrenceRow>(
      `SELECT id, series_id, occurs_on, cancelled_at, completed_at, blocks_overridden,
        task_patch, reminder_patch, notification_ids_json, created_at, updated_at
      FROM recurrence_occurrences
      WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return row === null ? null : this.mapRecurrenceOccurrence(row);
  }

  async listRecurrenceOccurrences(seriesId: EntityId): Promise<readonly RecurrenceOccurrence[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<RecurrenceOccurrenceRow>(
      `SELECT id, series_id, occurs_on, cancelled_at, completed_at, blocks_overridden,
        task_patch, reminder_patch, notification_ids_json, created_at, updated_at
      FROM recurrence_occurrences
      WHERE series_id = ? AND deleted_at IS NULL
      ORDER BY created_at ASC, id ASC`,
      [seriesId],
    );
    return rows.map((row) => this.mapRecurrenceOccurrence(row));
  }

  async deleteRecurrenceOccurrence(id: EntityId): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    const deletedAt = new Date().toISOString();
    await database.runAsync(
      'UPDATE schedule_blocks SET deleted_at = ?, updated_at = ? WHERE occurrence_id = ?',
      [deletedAt, deletedAt, id],
    );
    await database.runAsync(
      'UPDATE recurrence_occurrences SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [deletedAt, deletedAt, id],
    );
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

  private mapRecurrenceOccurrence(row: RecurrenceOccurrenceRow): RecurrenceOccurrence {
    return {
      id: row.id,
      seriesId: row.series_id,
      occursOn: row.occurs_on,
      cancelledAt: row.cancelled_at,
      completedAt: row.completed_at,
      blocksOverridden: row.blocks_overridden === 1,
      taskPatch:
        row.task_patch === null
          ? null
          : JSON.parse(row.task_patch) as RecurrenceOccurrence['taskPatch'],
      reminderPatch:
        row.reminder_patch === null
          ? null
          : JSON.parse(row.reminder_patch) as RecurrenceOccurrence['reminderPatch'],
      notificationIds: row.notification_ids_json === null ? [] : JSON.parse(row.notification_ids_json) as readonly string[],
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
      deletedAt: null,
    };
  }

  private mapRecurrenceRevision(row: RecurrenceRevisionRow): RecurrenceRevision {
    return {
      id: row.id,
      seriesId: row.series_id,
      effectiveFrom: row.effective_from,
      frequency: row.frequency,
      interval: row.interval,
      weekdays: row.weekdays_json === null ? undefined : JSON.parse(row.weekdays_json),
      taskPatch: JSON.parse(row.task_patch_json) as RecurrenceRevision['taskPatch'],
      blockTemplates: JSON.parse(row.block_templates_json) as RecurrenceRevision['blockTemplates'],
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
      deletedAt: null,
    };
  }

  private async initializeDatabase(): Promise<void> {
    if (this.scope.kind === 'autonomous') {
      await migrateLegacyDatabaseToAutonomousScope({
        openDatabaseAsync: (name) =>
          SQLite.openDatabaseAsync(name) as unknown as Promise<ScopeMigrationDatabase>,
        backupDatabaseAsync: ({ sourceDatabase, destDatabase }) =>
          SQLite.backupDatabaseAsync({
            sourceDatabase: sourceDatabase as SQLite.SQLiteDatabase,
            destDatabase: destDatabase as SQLite.SQLiteDatabase,
          }),
      });
    }

    const database = await this.getDatabase();
    await migrateDatabase(database);
  }

  private getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (this.databasePromise === null) {
      this.databasePromise = SQLite.openDatabaseAsync(databaseNameForScope(this.scope));
    }

    return this.databasePromise;
  }
}

export function createDataSource(scope: LocalDataScope = { kind: 'autonomous' }): AppDataSource {
  return new NativeDataSource(scope);
}
