import type {
  AppSettings,
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
  saveRecurrenceSeries(series: RecurrenceSeries): Promise<void>;
  getRecurrenceSeries(id: EntityId): Promise<RecurrenceSeries | null>;
  transaction<T>(operation: () => Promise<T>): Promise<T>;
}
