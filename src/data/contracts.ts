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

export interface AppDataSource {
  initialize(): Promise<void>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  saveProject(project: Project): Promise<void>;
  getProject(id: EntityId): Promise<Project | null>;
  listProjects(): Promise<readonly Project[]>;
  deleteProject(id: EntityId): Promise<void>;
  saveTaskItem(task: TaskItem): Promise<void>;
  getTaskItem(id: EntityId): Promise<TaskItem | null>;
  listTaskItems(): Promise<readonly TaskItem[]>;
  deleteTaskItem(id: EntityId): Promise<void>;
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
  saveRecurrenceOccurrence(occurrence: RecurrenceOccurrence): Promise<void>;
  getRecurrenceOccurrence(id: EntityId): Promise<RecurrenceOccurrence | null>;
  listRecurrenceOccurrences(): Promise<readonly RecurrenceOccurrence[]>;
  deleteRecurrenceOccurrence(id: EntityId): Promise<void>;
  saveCompletedItem(item: CompletedItem): Promise<void>;
  getCompletedItem(id: EntityId): Promise<CompletedItem | null>;
  transaction<T>(operation: () => Promise<T>): Promise<T>;
}
