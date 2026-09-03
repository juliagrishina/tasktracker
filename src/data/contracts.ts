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

export interface AppDataSource {
  initialize(): Promise<void>;
  clearAll(): Promise<void>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  getDailyEnergyEntry(recordedOn: string): Promise<DailyEnergyEntry | null>;
  listDailyEnergyEntries(): Promise<readonly DailyEnergyEntry[]>;
  saveDailyEnergyEntry(entry: DailyEnergyEntry): Promise<void>;
  saveProject(project: Project): Promise<void>;
  getProject(id: EntityId): Promise<Project | null>;
  listProjects(): Promise<readonly Project[]>;
  deleteProject(id: EntityId): Promise<void>;
  saveTaskItem(task: TaskItem): Promise<void>;
  getTaskItem(id: EntityId): Promise<TaskItem | null>;
  listTaskItems(): Promise<readonly TaskItem[]>;
  deleteTaskItem(id: EntityId): Promise<void>;
  saveTransferHistory(history: TransferHistory): Promise<void>;
  listTransferHistories(taskItemId?: EntityId): Promise<readonly TransferHistory[]>;
  saveReminder(reminder: Reminder): Promise<void>;
  getReminder(id: EntityId): Promise<Reminder | null>;
  listReminders(): Promise<readonly Reminder[]>;
  deleteReminder(id: EntityId): Promise<void>;
  saveScheduleBlock(block: ScheduleBlock): Promise<void>;
  getScheduleBlock(id: EntityId): Promise<ScheduleBlock | null>;
  listScheduleBlocks(): Promise<readonly ScheduleBlock[]>;
  listScheduleBlocksForTaskItem(taskItemId: EntityId): Promise<readonly ScheduleBlock[]>;
  deleteScheduleBlock(id: EntityId): Promise<void>;
  saveRecurrenceSeries(series: RecurrenceSeries): Promise<void>;
  getRecurrenceSeries(id: EntityId): Promise<RecurrenceSeries | null>;
  listRecurrenceSeries(): Promise<readonly RecurrenceSeries[]>;
  deleteRecurrenceSeries(id: EntityId): Promise<void>;
  saveRecurrenceRevision(revision: RecurrenceRevision): Promise<void>;
  listRecurrenceRevisions(seriesId: EntityId): Promise<readonly RecurrenceRevision[]>;
  deleteRecurrenceRevision(id: EntityId): Promise<void>;
  saveRecurrenceOccurrence(occurrence: RecurrenceOccurrence): Promise<void>;
  getRecurrenceOccurrence(id: EntityId): Promise<RecurrenceOccurrence | null>;
  listRecurrenceOccurrences(seriesId: EntityId): Promise<readonly RecurrenceOccurrence[]>;
  deleteRecurrenceOccurrence(id: EntityId): Promise<void>;
  transaction<T>(operation: () => Promise<T>): Promise<T>;
}
