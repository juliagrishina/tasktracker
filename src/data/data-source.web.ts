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
import { databaseNameForScope, type LocalDataScope } from './local-data-scopes';
import { migrateLegacyEntityIds } from './legacy-id-migration';
import { createLocalSyncId, createSyncTrackingDataSource, type RemoteSyncChange, type SyncMetadataDataSource, type SyncMutationResult, type SyncOutboxMutation, type SyncTrackingDataSource } from './sync-outbox';

export interface InMemoryDataSource extends SyncTrackingDataSource {
  debugSettingsRowCount(): number;
  debugRowExists(id: EntityId): boolean;
}

export interface BrowserScopeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface BrowserDataSnapshot {
  settings: AppSettings | null;
  dailyEnergyEntries: DailyEnergyEntry[];
  projects: Project[];
  taskItems: TaskItem[];
  reminders: Reminder[];
  scheduleBlocks: ScheduleBlock[];
  recurrenceSeries: RecurrenceSeries[];
  recurrenceOccurrences: RecurrenceOccurrence[];
  recurrenceRevisions: RecurrenceRevision[];
  transferHistories: TransferHistory[];
  syncState: { deviceId: string; dataGeneration: number } | null;
  syncCursor: number | null;
  syncEntityVersions: readonly [string, number][];
  syncOutbox: SyncOutboxMutation[];
}

function compareByCreatedAt<T extends { id: EntityId; createdAt: string }>(
  left: T,
  right: T,
): number {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function replaceMap<T>(target: Map<EntityId, T>, source: Map<EntityId, T>): void {
  target.clear();
  for (const [id, value] of source) {
    target.set(id, value);
  }
}

class BrowserInMemoryDataSource implements AppDataSource, SyncMetadataDataSource {
  private settings: AppSettings | null = null;
  private readonly dailyEnergyEntries = new Map<string, DailyEnergyEntry>();
  private readonly projects = new Map<EntityId, Project>();
  private readonly taskItems = new Map<EntityId, TaskItem>();
  private readonly reminders = new Map<EntityId, Reminder>();
  private readonly scheduleBlocks = new Map<EntityId, ScheduleBlock>();
  private readonly recurrenceSeries = new Map<EntityId, RecurrenceSeries>();
  private readonly recurrenceOccurrences = new Map<EntityId, RecurrenceOccurrence>();
  private readonly recurrenceRevisions = new Map<EntityId, RecurrenceRevision>();
  private readonly transferHistories = new Map<EntityId, TransferHistory>();
  private syncState: { deviceId: string; dataGeneration: number } | null = null;
  private syncCursor: number | null = null;
  private readonly syncEntityVersions = new Map<string, number>();
  private readonly syncOutbox = new Map<string, SyncOutboxMutation>();

  constructor(snapshot?: BrowserDataSnapshot) {
    if (snapshot !== undefined) {
      this.restoreSnapshot(snapshot);
    }
  }

  async initialize(): Promise<void> {
    if (this.settings === null) {
      this.settings = getDefaultSettings();
    }
  }

  async getSettings(): Promise<AppSettings> {
    await this.initialize();
    const settings = this.settings ?? getDefaultSettings();
    return { ...settings, timeZoneId: resolveTimeZoneId(settings) };
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.initialize();
    this.settings = settings;
  }

  async getDailyEnergyEntry(recordedOn: string): Promise<DailyEnergyEntry | null> {
    await this.initialize();
    return this.dailyEnergyEntries.get(recordedOn) ?? null;
  }

  async enqueueSyncMutation(input: Omit<SyncOutboxMutation, 'mutationId' | 'deviceId' | 'expectedVersion' | 'dataGeneration' | 'createdAt'>): Promise<SyncOutboxMutation> {
    await this.initialize();
    if (this.syncState === null) this.syncState = { deviceId: createLocalSyncId(), dataGeneration: 1 };
    const versionKey = `${input.entityType}:${input.entityId}`;
    const expectedVersion = this.syncEntityVersions.get(versionKey) ?? 0;
    this.syncEntityVersions.set(versionKey, expectedVersion + 1);
    const mutation: SyncOutboxMutation = { ...input, mutationId: createLocalSyncId(), deviceId: this.syncState.deviceId, expectedVersion, dataGeneration: this.syncState.dataGeneration, createdAt: new Date().toISOString() };
    this.syncOutbox.set(mutation.mutationId, mutation);
    return mutation;
  }

  async listSyncOutbox(): Promise<readonly SyncOutboxMutation[]> {
    await this.initialize();
    return [...this.syncOutbox.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.mutationId.localeCompare(right.mutationId));
  }

  async acknowledgeSyncMutations(results: readonly SyncMutationResult[]): Promise<void> {
    await this.initialize();
    for (const result of results) {
      this.syncOutbox.delete(result.mutationId);
      this.syncEntityVersions.set(`${result.entityType}:${result.entityId}`, result.version);
    }
  }

  async getSyncCursor(): Promise<number> {
    await this.initialize();
    return this.syncCursor ?? 0;
  }

  async applyRemoteSyncChanges(changes: readonly RemoteSyncChange[], cursor: number): Promise<void> {
    await this.transaction(async () => {
      for (const change of changes) this.applyRemoteSyncChange(change);
      if (this.syncState === null) this.syncState = { deviceId: createLocalSyncId(), dataGeneration: 1 };
      this.syncCursor = cursor;
    });
  }

  async resetForFullResync(dataGeneration: number): Promise<void> {
    await this.transaction(async () => {
      const deviceId = this.syncState?.deviceId ?? createLocalSyncId();
      this.settings = getDefaultSettings();
      this.dailyEnergyEntries.clear(); this.projects.clear(); this.taskItems.clear(); this.reminders.clear();
      this.scheduleBlocks.clear(); this.recurrenceSeries.clear(); this.recurrenceOccurrences.clear();
      this.recurrenceRevisions.clear(); this.transferHistories.clear();
      this.syncOutbox.clear(); this.syncEntityVersions.clear();
      this.syncCursor = 0;
      this.syncState = { deviceId, dataGeneration };
    });
  }

  async clearAll(): Promise<void> {
    this.settings = getDefaultSettings();
    this.dailyEnergyEntries.clear(); this.projects.clear(); this.taskItems.clear(); this.reminders.clear();
    this.scheduleBlocks.clear(); this.recurrenceSeries.clear(); this.recurrenceOccurrences.clear();
    this.recurrenceRevisions.clear(); this.transferHistories.clear();
  }

  async listDailyEnergyEntries(): Promise<readonly DailyEnergyEntry[]> {
    await this.initialize();
    return [...this.dailyEnergyEntries.values()].sort((left, right) =>
      left.recordedOn.localeCompare(right.recordedOn),
    );
  }

  async saveDailyEnergyEntry(entry: DailyEnergyEntry): Promise<void> {
    await this.initialize();
    this.dailyEnergyEntries.set(entry.recordedOn, { ...entry });
  }

  async saveProject(project: Project): Promise<void> {
    await this.initialize();
    this.projects.set(project.id, { ...project, updatedAt: new Date().toISOString() });
  }

  async getProject(id: EntityId): Promise<Project | null> {
    await this.initialize();
    const project = this.projects.get(id) ?? null;
    return project === null || project.deletedAt !== null ? null : project;
  }

  async listProjects(): Promise<readonly Project[]> {
    await this.initialize();
    return [...this.projects.values()]
      .filter((project) => project.deletedAt === null)
      .sort(compareByCreatedAt);
  }

  async deleteProject(id: EntityId): Promise<void> {
    await this.initialize();
    const deletedAt = new Date().toISOString();
    for (const task of this.taskItems.values()) {
      if (task.projectId === id) {
        this.taskItems.set(task.id, { ...task, projectId: null, updatedAt: deletedAt });
      }
    }
    const project = this.projects.get(id);
    if (project !== undefined) {
      this.projects.set(id, { ...project, deletedAt, updatedAt: deletedAt });
    }
  }

  async saveTaskItem(task: TaskItem): Promise<void> {
    await this.initialize();
    const parent =
      task.kind === 'subtask' ? await this.getTaskItem(task.parentTaskId) : null;
    assertTaskItemParent(task, parent);
    this.taskItems.set(task.id, { ...task, updatedAt: new Date().toISOString() });
  }

  async getTaskItem(id: EntityId): Promise<TaskItem | null> {
    await this.initialize();
    const task = this.taskItems.get(id) ?? null;
    return task === null || task.deletedAt !== null ? null : task;
  }

  async listTaskItems(): Promise<readonly TaskItem[]> {
    await this.initialize();
    return [...this.taskItems.values()]
      .filter((task) => task.deletedAt === null)
      .sort(compareByCreatedAt);
  }

  async deleteTaskItem(id: EntityId): Promise<void> {
    await this.initialize();
    const deletedAt = new Date().toISOString();
    const childIds = [...this.taskItems.values()]
      .filter((task) => task.kind === 'subtask' && task.parentTaskId === id)
      .map((task) => task.id);

    for (const childId of childIds) {
      this.deleteTaskRelatedRows(childId, deletedAt);
      const child = this.taskItems.get(childId);
      if (child !== undefined) {
        this.taskItems.set(childId, { ...child, deletedAt, updatedAt: deletedAt });
      }
    }
    this.deleteTaskRelatedRows(id, deletedAt);
    const task = this.taskItems.get(id);
    if (task !== undefined) {
      this.taskItems.set(id, { ...task, deletedAt, updatedAt: deletedAt });
    }
  }

  async saveReminder(reminder: Reminder): Promise<void> {
    await this.initialize();
    assertReminderShape(reminder);
    this.reminders.set(reminder.id, { ...reminder, updatedAt: new Date().toISOString() });
  }

  async getReminder(id: EntityId): Promise<Reminder | null> {
    await this.initialize();
    const reminder = this.reminders.get(id) ?? null;
    return reminder === null || reminder.deletedAt !== null ? null : reminder;
  }

  async listReminders(): Promise<readonly Reminder[]> {
    await this.initialize();
    return [...this.reminders.values()]
      .filter((reminder) => reminder.deletedAt === null)
      .sort(compareByCreatedAt);
  }

  async deleteReminder(id: EntityId): Promise<void> {
    await this.initialize();
    const reminder = this.reminders.get(id);
    if (reminder !== undefined) {
      const deletedAt = new Date().toISOString();
      this.deleteRecurrenceRelatedRows('reminder', id, deletedAt);
      this.reminders.set(id, { ...reminder, deletedAt, updatedAt: deletedAt });
    }
  }

  async saveScheduleBlock(block: ScheduleBlock): Promise<void> {
    await this.initialize();
    const task = await this.getTaskItem(block.taskItemId);

    if (task === null) {
      throw new Error('Задача для блока расписания не найдена');
    }

    assertScheduleBlockShape(block, task);
    this.scheduleBlocks.set(block.id, { ...block, updatedAt: new Date().toISOString() });
  }

  async getScheduleBlock(id: EntityId): Promise<ScheduleBlock | null> {
    await this.initialize();
    const block = this.scheduleBlocks.get(id) ?? null;
    return block === null || block.deletedAt !== null ? null : block;
  }

  async listScheduleBlocks(): Promise<readonly ScheduleBlock[]> {
    await this.initialize();
    return [...this.scheduleBlocks.values()]
      .filter((block) => block.deletedAt === null)
      .sort(compareByCreatedAt);
  }

  async saveTransferHistory(history: TransferHistory): Promise<void> {
    await this.initialize();
    this.transferHistories.set(history.id, { ...history });
  }

  async listTransferHistories(taskItemId?: EntityId): Promise<readonly TransferHistory[]> {
    await this.initialize();
    return [...this.transferHistories.values()]
      .filter((history) => taskItemId === undefined || history.taskItemId === taskItemId)
      .sort(compareByCreatedAt);
  }

  async listScheduleBlocksForTaskItem(taskItemId: EntityId): Promise<readonly ScheduleBlock[]> {
    const blocks = await this.listScheduleBlocks();
    return blocks.filter((block) => block.taskItemId === taskItemId);
  }

  async deleteScheduleBlock(id: EntityId): Promise<void> {
    await this.initialize();
    const block = this.scheduleBlocks.get(id);
    if (block !== undefined) {
      const deletedAt = new Date().toISOString();
      this.scheduleBlocks.set(id, { ...block, deletedAt, updatedAt: deletedAt });
    }
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

    this.recurrenceSeries.set(series.id, { ...series, updatedAt: new Date().toISOString() });
  }

  async getRecurrenceSeries(id: EntityId): Promise<RecurrenceSeries | null> {
    await this.initialize();
    const series = this.recurrenceSeries.get(id) ?? null;
    return series === null || series.deletedAt !== null ? null : series;
  }

  async listRecurrenceSeries(): Promise<readonly RecurrenceSeries[]> {
    await this.initialize();
    return [...this.recurrenceSeries.values()]
      .filter((series) => series.deletedAt === null)
      .sort(compareByCreatedAt);
  }

  async deleteRecurrenceSeries(id: EntityId): Promise<void> {
    await this.initialize();
    const series = this.recurrenceSeries.get(id);
    if (series !== undefined) {
      const deletedAt = new Date().toISOString();
      this.recurrenceSeries.set(id, { ...series, deletedAt, updatedAt: deletedAt });
      this.deleteRecurrenceOccurrencesForSeries(id, deletedAt);
      for (const [revisionId, revision] of this.recurrenceRevisions) {
        if (revision.seriesId === id) this.recurrenceRevisions.set(revisionId, { ...revision, deletedAt, updatedAt: deletedAt });
      }
    }
  }

  async saveRecurrenceRevision(revision: RecurrenceRevision): Promise<void> {
    await this.initialize();
    if (await this.getRecurrenceSeries(revision.seriesId) === null) throw new Error('Серия повторения для изменения не найдена');
    const duplicate = [...this.recurrenceRevisions.values()].find((candidate) => candidate.id !== revision.id && candidate.seriesId === revision.seriesId && candidate.effectiveFrom === revision.effectiveFrom && candidate.deletedAt === null);
    if (duplicate !== undefined) throw new Error('Изменение серии на эту дату уже существует');
    this.recurrenceRevisions.set(revision.id, { ...revision, updatedAt: new Date().toISOString() });
  }

  async listRecurrenceRevisions(seriesId: EntityId): Promise<readonly RecurrenceRevision[]> {
    await this.initialize();
    return [...this.recurrenceRevisions.values()]
      .filter((revision) => revision.seriesId === seriesId && revision.deletedAt === null)
      .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom) || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  }

  async deleteRecurrenceRevision(id: EntityId): Promise<void> {
    await this.initialize();
    const revision = this.recurrenceRevisions.get(id);
    if (revision !== undefined) {
      const deletedAt = new Date().toISOString();
      this.recurrenceRevisions.set(id, { ...revision, deletedAt, updatedAt: deletedAt });
    }
  }

  async saveRecurrenceOccurrence(occurrence: RecurrenceOccurrence): Promise<void> {
    await this.initialize();
    const series = await this.getRecurrenceSeries(occurrence.seriesId);
    if (series === null) {
      throw new Error('Серия повторения для экземпляра не найдена');
    }

    const duplicate = [...this.recurrenceOccurrences.values()].find((candidate) =>
      candidate.id !== occurrence.id &&
      candidate.seriesId === occurrence.seriesId &&
      candidate.occursOn === occurrence.occursOn &&
      candidate.deletedAt === null,
    );
    if (duplicate !== undefined) {
      throw new Error('Экземпляр серии на эту дату уже существует');
    }

    this.recurrenceOccurrences.set(occurrence.id, {
      ...occurrence,
      updatedAt: new Date().toISOString(),
    });
  }

  async getRecurrenceOccurrence(id: EntityId): Promise<RecurrenceOccurrence | null> {
    await this.initialize();
    const occurrence = this.recurrenceOccurrences.get(id) ?? null;
    return occurrence === null || occurrence.deletedAt !== null ? null : occurrence;
  }

  async listRecurrenceOccurrences(seriesId: EntityId): Promise<readonly RecurrenceOccurrence[]> {
    await this.initialize();
    return [...this.recurrenceOccurrences.values()]
      .filter((occurrence) => occurrence.seriesId === seriesId && occurrence.deletedAt === null)
      .sort(compareByCreatedAt);
  }

  async deleteRecurrenceOccurrence(id: EntityId): Promise<void> {
    await this.initialize();
    const occurrence = this.recurrenceOccurrences.get(id);
    if (occurrence !== undefined) {
      const deletedAt = new Date().toISOString();
      this.recurrenceOccurrences.set(id, { ...occurrence, deletedAt, updatedAt: deletedAt });
      this.deleteOccurrenceBlocks(id, deletedAt);
    }
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    await this.initialize();
    const snapshot = {
      settings: this.settings,
      dailyEnergyEntries: new Map(this.dailyEnergyEntries),
      projects: new Map(this.projects),
      taskItems: new Map(this.taskItems),
      reminders: new Map(this.reminders),
      scheduleBlocks: new Map(this.scheduleBlocks),
      recurrenceSeries: new Map(this.recurrenceSeries),
      recurrenceOccurrences: new Map(this.recurrenceOccurrences),
      recurrenceRevisions: new Map(this.recurrenceRevisions),
      transferHistories: new Map(this.transferHistories),
      syncState: this.syncState === null ? null : { ...this.syncState },
      syncCursor: this.syncCursor,
      syncEntityVersions: new Map(this.syncEntityVersions),
      syncOutbox: new Map(this.syncOutbox),
    };

    try {
      return await operation();
    } catch (error) {
      this.settings = snapshot.settings;
      replaceMap(this.dailyEnergyEntries, snapshot.dailyEnergyEntries);
      replaceMap(this.projects, snapshot.projects);
      replaceMap(this.taskItems, snapshot.taskItems);
      replaceMap(this.reminders, snapshot.reminders);
      replaceMap(this.scheduleBlocks, snapshot.scheduleBlocks);
      replaceMap(this.recurrenceSeries, snapshot.recurrenceSeries);
      replaceMap(this.recurrenceOccurrences, snapshot.recurrenceOccurrences);
      replaceMap(this.recurrenceRevisions, snapshot.recurrenceRevisions);
      replaceMap(this.transferHistories, snapshot.transferHistories);
      this.syncState = snapshot.syncState;
      this.syncCursor = snapshot.syncCursor;
      replaceMap(this.syncEntityVersions, snapshot.syncEntityVersions);
      replaceMap(this.syncOutbox, snapshot.syncOutbox);
      throw error;
    }
  }

  debugSettingsRowCount(): number {
    return this.settings === null ? 0 : 1;
  }

  debugRowExists(id: EntityId): boolean {
    return (
      this.projects.has(id) ||
      this.taskItems.has(id) ||
      this.reminders.has(id) ||
      this.scheduleBlocks.has(id) ||
      this.recurrenceSeries.has(id)
      || this.recurrenceOccurrences.has(id)
      || this.recurrenceRevisions.has(id)
    );
  }

  exportSnapshot(): BrowserDataSnapshot {
    return {
      settings: this.settings,
      dailyEnergyEntries: [...this.dailyEnergyEntries.values()],
      projects: [...this.projects.values()],
      taskItems: [...this.taskItems.values()],
      reminders: [...this.reminders.values()],
      scheduleBlocks: [...this.scheduleBlocks.values()],
      recurrenceSeries: [...this.recurrenceSeries.values()],
      recurrenceOccurrences: [...this.recurrenceOccurrences.values()],
      recurrenceRevisions: [...this.recurrenceRevisions.values()],
      transferHistories: [...this.transferHistories.values()],
      syncState: this.syncState,
      syncCursor: this.syncCursor,
      syncEntityVersions: [...this.syncEntityVersions.entries()],
      syncOutbox: [...this.syncOutbox.values()],
    };
  }

  private restoreSnapshot(snapshot: BrowserDataSnapshot): void {
    const migrated = migrateLegacyEntityIds(snapshot);
    this.settings = migrated.settings;
    replaceMap(this.dailyEnergyEntries, new Map(migrated.dailyEnergyEntries.map((entry) => [entry.recordedOn, entry])));
    replaceMap(this.projects, new Map(migrated.projects.map((project) => [project.id, project])));
    replaceMap(this.taskItems, new Map(migrated.taskItems.map((task) => [task.id, task])));
    replaceMap(this.reminders, new Map(migrated.reminders.map((reminder) => [reminder.id, reminder])));
    replaceMap(this.scheduleBlocks, new Map(migrated.scheduleBlocks.map((block) => [block.id, block])));
    replaceMap(this.recurrenceSeries, new Map(migrated.recurrenceSeries.map((series) => [series.id, series])));
    replaceMap(this.recurrenceOccurrences, new Map(migrated.recurrenceOccurrences.map((occurrence) => [occurrence.id, occurrence])));
    replaceMap(this.recurrenceRevisions, new Map(migrated.recurrenceRevisions.map((revision) => [revision.id, revision])));
    replaceMap(this.transferHistories, new Map(migrated.transferHistories.map((history) => [history.id, history])));
    this.syncState = migrated.syncState;
    this.syncCursor = migrated.syncCursor;
    replaceMap(this.syncEntityVersions, new Map(migrated.syncEntityVersions));
    replaceMap(this.syncOutbox, new Map(migrated.syncOutbox.map((mutation) => [mutation.mutationId, mutation])));
  }

  private applyRemoteSyncChange(change: RemoteSyncChange): void {
    const payload = change.payload as Record<string, unknown>;
    const deletedAt = change.operation === 'delete' ? new Date().toISOString() : null;
    if (change.entityType === 'projects') this.projects.set(change.entityId, { ...(payload as unknown as Project), id: change.entityId, deletedAt });
    else if (change.entityType === 'task_items') this.taskItems.set(change.entityId, { ...(payload as TaskItem), id: change.entityId, deletedAt });
    else if (change.entityType === 'reminders') this.reminders.set(change.entityId, { ...(payload as unknown as Reminder), id: change.entityId, deletedAt });
    else if (change.entityType === 'schedule_blocks') this.scheduleBlocks.set(change.entityId, { ...(payload as unknown as ScheduleBlock), id: change.entityId, deletedAt });
    else if (change.entityType === 'recurrence_series') this.recurrenceSeries.set(change.entityId, { ...(payload as unknown as RecurrenceSeries), id: change.entityId, deletedAt });
    else if (change.entityType === 'recurrence_occurrences') this.recurrenceOccurrences.set(change.entityId, { ...(payload as unknown as RecurrenceOccurrence), id: change.entityId, deletedAt });
    else if (change.entityType === 'recurrence_revisions') this.recurrenceRevisions.set(change.entityId, { ...(payload as unknown as RecurrenceRevision), id: change.entityId, deletedAt });
    else if (change.entityType === 'transfer_history') this.transferHistories.set(change.entityId, { ...(payload as unknown as TransferHistory), id: change.entityId });
    else if (change.entityType === 'daily_energy_entries' && change.operation === 'upsert') this.dailyEnergyEntries.set(change.entityId, payload as unknown as DailyEnergyEntry);
    else if (change.entityType === 'user_settings' && change.operation === 'upsert') {
      const current = this.settings ?? getDefaultSettings();
      this.settings = { ...current, ...pickSharedSettings(payload) };
    }
    this.syncEntityVersions.set(`${change.entityType}:${change.entityId}`, change.version);
  }

  private deleteTaskRelatedRows(taskItemId: EntityId, deletedAt: string): void {
    for (const [id, block] of this.scheduleBlocks) {
      if (block.taskItemId === taskItemId) {
        this.scheduleBlocks.set(id, { ...block, deletedAt, updatedAt: deletedAt });
      }
    }
    for (const [id, series] of this.recurrenceSeries) {
      if (series.itemKind === 'task' && series.itemId === taskItemId) {
        this.recurrenceSeries.set(id, { ...series, deletedAt, updatedAt: deletedAt });
        this.deleteRecurrenceOccurrencesForSeries(id, deletedAt);
      }
    }
  }

  private deleteRecurrenceRelatedRows(
    itemKind: RecurrenceSeries['itemKind'],
    itemId: EntityId,
    deletedAt: string,
  ): void {
    for (const [id, series] of this.recurrenceSeries) {
      if (series.itemKind === itemKind && series.itemId === itemId) {
        this.recurrenceSeries.set(id, { ...series, deletedAt, updatedAt: deletedAt });
        this.deleteRecurrenceOccurrencesForSeries(id, deletedAt);
      }
    }
  }

  private deleteRecurrenceOccurrencesForSeries(seriesId: EntityId, deletedAt: string): void {
    for (const [id, occurrence] of this.recurrenceOccurrences) {
      if (occurrence.seriesId === seriesId) {
        this.recurrenceOccurrences.set(id, { ...occurrence, deletedAt, updatedAt: deletedAt });
        this.deleteOccurrenceBlocks(id, deletedAt);
      }
    }
  }

  private deleteOccurrenceBlocks(occurrenceId: EntityId, deletedAt: string): void {
    for (const [id, block] of this.scheduleBlocks) {
      if (block.occurrenceId === occurrenceId) {
        this.scheduleBlocks.set(id, { ...block, deletedAt, updatedAt: deletedAt });
      }
    }
  }
}

export function createInMemoryDataSource(
  scope: LocalDataScope = { kind: 'autonomous' },
): InMemoryDataSource {
  return createSyncTrackingDataSource(new BrowserInMemoryDataSource(), scope) as InMemoryDataSource;
}

const scopedDataSources = new Map<string, AppDataSource>();

export function createDataSource(scope: LocalDataScope = { kind: 'autonomous' }): AppDataSource {
  const scopeKey = databaseNameForScope(scope);
  const existing = scopedDataSources.get(scopeKey);
  if (existing !== undefined) {
    return existing;
  }

  const browserStorage = getBrowserStorage();
  const source = browserStorage === null
    ? createInMemoryDataSource(scope)
    : createPersistentBrowserDataSource(scope, browserStorage);
  scopedDataSources.set(scopeKey, source);
  return source;
}

export function createPersistentBrowserDataSource(
  scope: LocalDataScope,
  storage: BrowserScopeStorage,
): AppDataSource {
  const storageKey = `tasktracker.browser-data.${databaseNameForScope(scope)}.v1`;
  const source = new BrowserInMemoryDataSource(parseSnapshot(storage.getItem(storageKey)));
  storage.setItem(storageKey, JSON.stringify(source.exportSnapshot()));
  const persisted = createPersistedDataSource(source, () => {
    storage.setItem(storageKey, JSON.stringify(source.exportSnapshot()));
  });
  return createSyncTrackingDataSource(persisted, scope);
}

function createPersistedDataSource(
  source: BrowserInMemoryDataSource,
  persist: () => void,
): AppDataSource {
  let transactionDepth = 0;
  let changedDuringTransaction = false;

  return new Proxy(source, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') {
        return value;
      }

      if (property === 'transaction') {
        return async (operation: () => Promise<unknown>) => {
          transactionDepth += 1;
          let completed = false;
          try {
            const result = await value.call(target, operation);
            completed = true;
            return result;
          } finally {
            transactionDepth -= 1;
            if (transactionDepth === 0) {
              if (completed && changedDuringTransaction) {
                persist();
              }
              changedDuringTransaction = false;
            }
          }
        };
      }

      return async (...args: unknown[]) => {
        const result = await value.apply(target, args);
        if (isMutation(property)) {
          if (transactionDepth > 0) {
            changedDuringTransaction = true;
          } else {
            persist();
          }
        }
        return result;
      };
    },
  }) as AppDataSource;
}

function isMutation(property: PropertyKey): boolean {
  return typeof property === 'string' && (property.startsWith('save') || property.startsWith('delete') || property === 'clearAll' || property === 'enqueueSyncMutation');
}

function parseSnapshot(value: string | null): BrowserDataSnapshot | undefined {
  if (value === null) {
    return undefined;
  }

  try {
    const snapshot = JSON.parse(value) as Partial<BrowserDataSnapshot>;
    if (!Array.isArray(snapshot.projects) || !Array.isArray(snapshot.taskItems)) {
      return undefined;
    }

    return {
      settings: snapshot.settings ?? null,
      dailyEnergyEntries: snapshot.dailyEnergyEntries ?? [],
      projects: snapshot.projects,
      taskItems: snapshot.taskItems,
      reminders: snapshot.reminders ?? [],
      scheduleBlocks: snapshot.scheduleBlocks ?? [],
      recurrenceSeries: snapshot.recurrenceSeries ?? [],
      recurrenceOccurrences: snapshot.recurrenceOccurrences ?? [],
      recurrenceRevisions: snapshot.recurrenceRevisions ?? [],
      transferHistories: snapshot.transferHistories ?? [],
      syncState: snapshot.syncState ?? null,
      syncCursor: snapshot.syncCursor ?? null,
      syncEntityVersions: Array.isArray(snapshot.syncEntityVersions) ? snapshot.syncEntityVersions : [],
      syncOutbox: Array.isArray(snapshot.syncOutbox) ? snapshot.syncOutbox : [],
    };
  } catch {
    return undefined;
  }
}

function getBrowserStorage(): BrowserScopeStorage | null {
  return (globalThis as { localStorage?: BrowserScopeStorage }).localStorage ?? null;
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
