import type {
  AppSettings,
  DailyEnergyEntry,
  EntityId,
  Project,
  RecurrenceOccurrence,
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

export interface InMemoryDataSource extends AppDataSource {
  debugSettingsRowCount(): number;
  debugRowExists(id: EntityId): boolean;
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

class BrowserInMemoryDataSource implements InMemoryDataSource {
  private settings: AppSettings | null = null;
  private readonly dailyEnergyEntries = new Map<string, DailyEnergyEntry>();
  private readonly projects = new Map<EntityId, Project>();
  private readonly taskItems = new Map<EntityId, TaskItem>();
  private readonly reminders = new Map<EntityId, Reminder>();
  private readonly scheduleBlocks = new Map<EntityId, ScheduleBlock>();
  private readonly recurrenceSeries = new Map<EntityId, RecurrenceSeries>();
  private readonly recurrenceOccurrences = new Map<EntityId, RecurrenceOccurrence>();
  private readonly transferHistories = new Map<EntityId, TransferHistory>();

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
      transferHistories: new Map(this.transferHistories),
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
      replaceMap(this.transferHistories, snapshot.transferHistories);
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
    );
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

export function createInMemoryDataSource(): InMemoryDataSource {
  return new BrowserInMemoryDataSource();
}

export function createDataSource(): AppDataSource {
  return createInMemoryDataSource();
}
