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
import { migrateLegacyIdsInNativeDatabase } from './native-legacy-id-migration';
import { migrateDatabase } from './migrations';
import { createLocalSyncId, createSyncTrackingDataSource, type IncomingSyncConflict, type RemoteSyncChange, type SyncConflict, type SyncMetadataDataSource, type SyncMutationResult, type SyncOutboxMutation } from './sync-outbox';
import { createStoredSyncConflict } from '../application/sync-conflicts';

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

class NativeDataSource implements AppDataSource, SyncMetadataDataSource {
  private databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor(private readonly scope: LocalDataScope) {}

  async initialize(): Promise<void> {
    if (this.initializationPromise === null) {
      this.initializationPromise = this.initializeDatabase();
    }

    await this.initializationPromise;
  }

  async enqueueSyncMutation(input: Omit<SyncOutboxMutation, 'mutationId' | 'deviceId' | 'expectedVersion' | 'dataGeneration' | 'createdAt'>): Promise<SyncOutboxMutation> {
    await this.initialize();
    const database = await this.getDatabase();
    const now = new Date().toISOString();
    let state = await database.getFirstAsync<{ device_id: string; data_generation: number }>(
      'SELECT device_id, data_generation FROM sync_state WHERE id = 1',
    );
    if (state === null) {
      state = { device_id: createLocalSyncId(), data_generation: 1 };
      await database.runAsync(
        'INSERT INTO sync_state (id, device_id, data_generation, pull_cursor, updated_at) VALUES (1, ?, ?, NULL, ?)',
        [state.device_id, state.data_generation, now],
      );
    }

    const versionRow = await database.getFirstAsync<{ version: number }>(
      'SELECT version FROM sync_entity_versions WHERE entity_type = ? AND entity_id = ?',
      [input.entityType, input.entityId],
    );
    const expectedVersion = versionRow?.version ?? 0;
    await database.runAsync(
      `INSERT INTO sync_entity_versions (entity_type, entity_id, version)
       VALUES (?, ?, ?)
       ON CONFLICT(entity_type, entity_id) DO UPDATE SET version = excluded.version`,
      [input.entityType, input.entityId, expectedVersion + 1],
    );

    const mutation: SyncOutboxMutation = {
      ...input,
      mutationId: createLocalSyncId(),
      deviceId: state.device_id,
      expectedVersion,
      dataGeneration: state.data_generation,
      createdAt: now,
    };
    await database.runAsync(
      `INSERT INTO sync_outbox (
        mutation_id, device_id, entity_type, entity_id, operation,
        expected_version, data_generation, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mutation.mutationId,
        mutation.deviceId,
        mutation.entityType,
        mutation.entityId,
        mutation.operation,
        mutation.expectedVersion,
        mutation.dataGeneration,
        JSON.stringify(mutation.payload),
        mutation.createdAt,
      ],
    );
    return mutation;
  }

  async listSyncOutbox(): Promise<readonly SyncOutboxMutation[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<{
      mutation_id: string; device_id: string; entity_type: SyncOutboxMutation['entityType']; entity_id: string;
      operation: SyncOutboxMutation['operation']; expected_version: number; data_generation: number;
      payload_json: string; created_at: string;
    }>(`SELECT mutation_id, device_id, entity_type, entity_id, operation,
          expected_version, data_generation, payload_json, created_at
        FROM sync_outbox ORDER BY created_at ASC, mutation_id ASC`);
    return rows.map((row) => ({
      mutationId: row.mutation_id,
      deviceId: row.device_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operation: row.operation,
      expectedVersion: row.expected_version,
      dataGeneration: row.data_generation,
      payload: JSON.parse(row.payload_json),
      createdAt: row.created_at,
    }));
  }

  async acknowledgeSyncMutations(results: readonly SyncMutationResult[]): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.withTransactionAsync(async () => {
      for (const result of results) {
        await database.runAsync('DELETE FROM sync_outbox WHERE mutation_id = ?', [result.mutationId]);
        await database.runAsync(
          `INSERT INTO sync_entity_versions (entity_type, entity_id, version) VALUES (?, ?, ?)
           ON CONFLICT(entity_type, entity_id) DO UPDATE SET version = excluded.version`,
          [result.entityType, result.entityId, result.version],
        );
      }
    });
  }

  async recordSyncConflicts(conflicts: readonly IncomingSyncConflict[]): Promise<readonly SyncConflict[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const now = new Date().toISOString();
    const stored = conflicts.map((conflict) => createStoredSyncConflict(conflict, createLocalSyncId(), now));
    await database.withTransactionAsync(async () => {
      for (const conflict of stored) {
        await database.runAsync(
          `INSERT INTO sync_conflicts (id, local_mutation_json, server_operation, server_version, server_payload_json, server_changed_at, server_device_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [conflict.id, JSON.stringify(conflict.local), conflict.server.operation, conflict.server.version, JSON.stringify(conflict.server.payload), conflict.server.changedAt, conflict.server.deviceId, conflict.createdAt],
        );
      }
    });
    return stored;
  }

  async listSyncConflicts(): Promise<readonly SyncConflict[]> {
    await this.initialize();
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<{ id: string; local_mutation_json: string; server_operation: 'upsert' | 'delete'; server_version: number; server_payload_json: string; server_changed_at: string; server_device_id: string | null; created_at: string }>(
      'SELECT id, local_mutation_json, server_operation, server_version, server_payload_json, server_changed_at, server_device_id, created_at FROM sync_conflicts ORDER BY created_at ASC',
    );
    return rows.map((row) => ({ id: row.id, local: JSON.parse(row.local_mutation_json) as SyncOutboxMutation, server: { operation: row.server_operation, version: row.server_version, payload: JSON.parse(row.server_payload_json), changedAt: row.server_changed_at, deviceId: row.server_device_id }, createdAt: row.created_at }));
  }

  async removeSyncConflict(id: string): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync('DELETE FROM sync_conflicts WHERE id = ?', [id]);
  }

  async getLastSyncSuccessAt(): Promise<string | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<{ last_success_at: string | null }>('SELECT last_success_at FROM sync_state WHERE id = 1');
    return row?.last_success_at ?? null;
  }

  async recordSyncSuccess(at: string): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    const state = await database.getFirstAsync<{ device_id: string; data_generation: number }>('SELECT device_id, data_generation FROM sync_state WHERE id = 1');
    if (state === null) {
      await database.runAsync('INSERT INTO sync_state (id, device_id, data_generation, pull_cursor, updated_at, last_success_at) VALUES (1, ?, 1, NULL, ?, ?)', [createLocalSyncId(), at, at]);
      return;
    }
    await database.runAsync('UPDATE sync_state SET last_success_at = ?, updated_at = ? WHERE id = 1', [at, at]);
  }

  async getSyncCursor(): Promise<number> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<{ pull_cursor: number | null }>('SELECT pull_cursor FROM sync_state WHERE id = 1');
    return row?.pull_cursor ?? 0;
  }

  async getLocalDataGeneration(): Promise<number> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<{ data_generation: number }>('SELECT data_generation FROM sync_state WHERE id = 1');
    return row?.data_generation ?? 1;
  }

  async applyRemoteSyncChanges(changes: readonly RemoteSyncChange[], cursor: number): Promise<void> {
    await this.transaction(async () => {
      for (const change of changes) await this.applyRemoteSyncChange(change);
      const database = await this.getDatabase();
      const current = await database.getFirstAsync<{ device_id: string; data_generation: number }>('SELECT device_id, data_generation FROM sync_state WHERE id = 1');
      if (current === null) {
        await database.runAsync('INSERT INTO sync_state (id, device_id, data_generation, pull_cursor, updated_at) VALUES (1, ?, 1, ?, ?)', [createLocalSyncId(), cursor, new Date().toISOString()]);
      } else {
        await database.runAsync('UPDATE sync_state SET pull_cursor = ?, updated_at = ? WHERE id = 1', [cursor, new Date().toISOString()]);
      }
    });
  }

  async resetForFullResync(dataGeneration: number): Promise<void> {
    await this.transaction(async () => {
      const database = await this.getDatabase();
      const tables = ['recurrence_revisions', 'recurrence_occurrences', 'recurrence_series', 'schedule_blocks', 'transfer_history', 'reminders', 'task_items', 'projects', 'daily_energy_entries'];
      for (const table of tables) await database.execAsync(`DELETE FROM ${table}`);
      await database.execAsync('DELETE FROM sync_outbox; DELETE FROM sync_entity_versions; DELETE FROM sync_conflicts;');
      const state = await database.getFirstAsync<{ device_id: string }>('SELECT device_id FROM sync_state WHERE id = 1');
      const deviceId = state?.device_id ?? createLocalSyncId();
      await database.runAsync(
        `INSERT INTO sync_state (id, device_id, data_generation, pull_cursor, updated_at, last_success_at) VALUES (1, ?, ?, NULL, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET device_id = excluded.device_id, data_generation = excluded.data_generation, pull_cursor = NULL, updated_at = excluded.updated_at, last_success_at = NULL`,
        [deviceId, dataGeneration, new Date().toISOString()],
      );
      await this.saveSettings(getDefaultSettings());
    });
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

  async clearAll(): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.execAsync('DELETE FROM recurrence_revisions; DELETE FROM recurrence_occurrences; DELETE FROM recurrence_series; DELETE FROM schedule_blocks; DELETE FROM transfer_history; DELETE FROM reminders; DELETE FROM task_items; DELETE FROM projects; DELETE FROM daily_energy_entries;');
    await this.saveSettings(getDefaultSettings());
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

  private async applyRemoteSyncChange(change: RemoteSyncChange): Promise<void> {
    const payload = change.payload as Record<string, unknown>;
    if (change.operation === 'delete') {
      if (change.entityType === 'projects') await this.deleteProject(change.entityId);
      else if (change.entityType === 'task_items') await this.deleteTaskItem(change.entityId);
      else if (change.entityType === 'reminders') await this.deleteReminder(change.entityId);
      else if (change.entityType === 'schedule_blocks') await this.deleteScheduleBlock(change.entityId);
      else if (change.entityType === 'recurrence_series') await this.deleteRecurrenceSeries(change.entityId);
      else if (change.entityType === 'recurrence_occurrences') await this.deleteRecurrenceOccurrence(change.entityId);
      else if (change.entityType === 'recurrence_revisions') await this.deleteRecurrenceRevision(change.entityId);
    } else if (change.entityType === 'projects') await this.saveProject({ ...(payload as unknown as Project), id: change.entityId });
    else if (change.entityType === 'task_items') await this.saveTaskItem({ ...(payload as TaskItem), id: change.entityId });
    else if (change.entityType === 'reminders') await this.saveReminder({ ...(payload as unknown as Reminder), id: change.entityId });
    else if (change.entityType === 'schedule_blocks') await this.saveScheduleBlock({ ...(payload as unknown as ScheduleBlock), id: change.entityId });
    else if (change.entityType === 'recurrence_series') await this.saveRecurrenceSeries({ ...(payload as unknown as RecurrenceSeries), id: change.entityId });
    else if (change.entityType === 'recurrence_occurrences') await this.saveRecurrenceOccurrence({ ...(payload as unknown as RecurrenceOccurrence), id: change.entityId });
    else if (change.entityType === 'recurrence_revisions') await this.saveRecurrenceRevision({ ...(payload as unknown as RecurrenceRevision), id: change.entityId });
    else if (change.entityType === 'transfer_history') await this.saveTransferHistory({ ...(payload as unknown as TransferHistory), id: change.entityId });
    else if (change.entityType === 'daily_energy_entries') await this.saveDailyEnergyEntry(payload as unknown as DailyEnergyEntry);
    else if (change.entityType === 'user_settings') {
      const current = await this.getSettings();
      await this.saveSettings({ ...current, ...pickSharedSettings(payload) });
    }
    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT INTO sync_entity_versions (entity_type, entity_id, version) VALUES (?, ?, ?)
       ON CONFLICT(entity_type, entity_id) DO UPDATE SET version = excluded.version`,
      [change.entityType, change.entityId, change.version],
    );
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
    await migrateLegacyIdsInNativeDatabase(database);
  }

  private getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (this.databasePromise === null) {
      this.databasePromise = SQLite.openDatabaseAsync(databaseNameForScope(this.scope));
    }

    return this.databasePromise;
  }
}

function pickSharedSettings(payload: Record<string, unknown>): Partial<AppSettings> {
  const result: Partial<AppSettings> = {};
  if (typeof payload.workdayStartsAt === 'string') result.workdayStartsAt = payload.workdayStartsAt;
  if (typeof payload.workdayEndsAt === 'string') result.workdayEndsAt = payload.workdayEndsAt;
  if (typeof payload.eveningReviewAt === 'string') result.eveningReviewAt = payload.eveningReviewAt;
  if (typeof payload.notificationLeadMinutes === 'number') result.notificationLeadMinutes = payload.notificationLeadMinutes;
  if (typeof payload.completionPromptDeferredOn === 'string' || payload.completionPromptDeferredOn === null) result.completionPromptDeferredOn = payload.completionPromptDeferredOn;
  return result;
}

export function createDataSource(scope: LocalDataScope = { kind: 'autonomous' }): AppDataSource {
  return createSyncTrackingDataSource(new NativeDataSource(scope), scope);
}
