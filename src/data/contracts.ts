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

export interface AppDataSource {
  initialize(): Promise<void>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  saveProject(project: Project): Promise<void>;
  getProject(id: EntityId): Promise<Project | null>;
  saveTaskItem(task: TaskItem): Promise<void>;
  getTaskItem(id: EntityId): Promise<TaskItem | null>;
  saveReminder(reminder: Reminder): Promise<void>;
  getReminder(id: EntityId): Promise<Reminder | null>;
  deleteReminder(id: EntityId): Promise<void>;
  saveScheduleBlock(block: ScheduleBlock): Promise<void>;
  getScheduleBlock(id: EntityId): Promise<ScheduleBlock | null>;
  saveRecurrenceSeries(series: RecurrenceSeries): Promise<void>;
  getRecurrenceSeries(id: EntityId): Promise<RecurrenceSeries | null>;
  saveCompletedItem(item: CompletedItem): Promise<void>;
  getCompletedItem(id: EntityId): Promise<CompletedItem | null>;
}
