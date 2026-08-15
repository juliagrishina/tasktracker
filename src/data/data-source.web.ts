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
import { getDefaultSettings } from './default-settings';

export interface InMemoryDataSource extends AppDataSource {
  debugSettingsRowCount(): number;
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
  private readonly projects = new Map<EntityId, Project>();
  private readonly taskItems = new Map<EntityId, TaskItem>();
  private readonly reminders = new Map<EntityId, Reminder>();
  private readonly scheduleBlocks = new Map<EntityId, ScheduleBlock>();
  private readonly recurrenceSeries = new Map<EntityId, RecurrenceSeries>();

  async initialize(): Promise<void> {
    if (this.settings === null) {
      this.settings = getDefaultSettings();
    }
  }

  async getSettings(): Promise<AppSettings> {
    await this.initialize();
    return this.settings ?? getDefaultSettings();
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.initialize();
    this.settings = settings;
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
      task.kind === 'subtask'
        ? (this.taskItems.get(task.parentTaskId) ?? null)
        : null;
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
      this.deleteTaskRelatedRows(childId);
      const child = this.taskItems.get(childId);
      if (child !== undefined) {
        this.taskItems.set(childId, { ...child, deletedAt, updatedAt: deletedAt });
      }
    }
    this.deleteTaskRelatedRows(id);
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

  async saveRecurrenceSeries(series: RecurrenceSeries): Promise<void> {
    await this.initialize();
    this.recurrenceSeries.set(series.id, { ...series, updatedAt: new Date().toISOString() });
  }

  async getRecurrenceSeries(id: EntityId): Promise<RecurrenceSeries | null> {
    await this.initialize();
    const series = this.recurrenceSeries.get(id) ?? null;
    return series === null || series.deletedAt !== null ? null : series;
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    await this.initialize();
    const snapshot = {
      settings: this.settings,
      projects: new Map(this.projects),
      taskItems: new Map(this.taskItems),
      reminders: new Map(this.reminders),
      scheduleBlocks: new Map(this.scheduleBlocks),
      recurrenceSeries: new Map(this.recurrenceSeries),
    };

    try {
      return await operation();
    } catch (error) {
      this.settings = snapshot.settings;
      replaceMap(this.projects, snapshot.projects);
      replaceMap(this.taskItems, snapshot.taskItems);
      replaceMap(this.reminders, snapshot.reminders);
      replaceMap(this.scheduleBlocks, snapshot.scheduleBlocks);
      replaceMap(this.recurrenceSeries, snapshot.recurrenceSeries);
      throw error;
    }
  }

  debugSettingsRowCount(): number {
    return this.settings === null ? 0 : 1;
  }

  private deleteTaskRelatedRows(taskItemId: EntityId): void {
    for (const [id, block] of this.scheduleBlocks) {
      if (block.taskItemId === taskItemId) {
        this.scheduleBlocks.delete(id);
      }
    }
    for (const [id, series] of this.recurrenceSeries) {
      if (series.taskItemId === taskItemId) {
        this.recurrenceSeries.delete(id);
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
