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
  private readonly completedItems = new Map<EntityId, CompletedItem>();

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
    this.projects.set(project.id, project);
  }

  async getProject(id: EntityId): Promise<Project | null> {
    await this.initialize();
    return this.projects.get(id) ?? null;
  }

  async listProjects(): Promise<readonly Project[]> {
    await this.initialize();
    return [...this.projects.values()].sort(compareByCreatedAt);
  }

  async deleteProject(id: EntityId): Promise<void> {
    await this.initialize();
    for (const task of this.taskItems.values()) {
      if (task.projectId === id) {
        this.taskItems.set(task.id, { ...task, projectId: null });
      }
    }
    this.projects.delete(id);
  }

  async saveTaskItem(task: TaskItem): Promise<void> {
    await this.initialize();
    const parent =
      task.kind === 'subtask'
        ? (this.taskItems.get(task.parentTaskId) ?? null)
        : null;
    assertTaskItemParent(task, parent);
    this.taskItems.set(task.id, task);
  }

  async getTaskItem(id: EntityId): Promise<TaskItem | null> {
    await this.initialize();
    return this.taskItems.get(id) ?? null;
  }

  async listTaskItems(): Promise<readonly TaskItem[]> {
    await this.initialize();
    return [...this.taskItems.values()].sort(compareByCreatedAt);
  }

  async deleteTaskItem(id: EntityId): Promise<void> {
    await this.initialize();
    const childIds = [...this.taskItems.values()]
      .filter((task) => task.kind === 'subtask' && task.parentTaskId === id)
      .map((task) => task.id);

    for (const childId of childIds) {
      this.deleteTaskRelatedRows(childId);
      this.taskItems.delete(childId);
    }
    this.deleteTaskRelatedRows(id);
    this.taskItems.delete(id);
  }

  async saveReminder(reminder: Reminder): Promise<void> {
    await this.initialize();
    assertReminderShape(reminder);
    this.reminders.set(reminder.id, reminder);
  }

  async getReminder(id: EntityId): Promise<Reminder | null> {
    await this.initialize();
    return this.reminders.get(id) ?? null;
  }

  async listReminders(): Promise<readonly Reminder[]> {
    await this.initialize();
    return [...this.reminders.values()].sort(compareByCreatedAt);
  }

  async deleteReminder(id: EntityId): Promise<void> {
    await this.initialize();
    this.reminders.delete(id);
  }

  async saveScheduleBlock(block: ScheduleBlock): Promise<void> {
    await this.initialize();
    const task = await this.getTaskItem(block.taskItemId);

    if (task === null) {
      throw new Error('Задача для блока расписания не найдена');
    }

    assertScheduleBlockShape(block, task);
    this.scheduleBlocks.set(block.id, block);
  }

  async getScheduleBlock(id: EntityId): Promise<ScheduleBlock | null> {
    await this.initialize();
    return this.scheduleBlocks.get(id) ?? null;
  }

  async listScheduleBlocks(): Promise<readonly ScheduleBlock[]> {
    await this.initialize();
    return [...this.scheduleBlocks.values()].sort(compareByCreatedAt);
  }

  async saveRecurrenceSeries(series: RecurrenceSeries): Promise<void> {
    await this.initialize();
    this.recurrenceSeries.set(series.id, series);
  }

  async getRecurrenceSeries(id: EntityId): Promise<RecurrenceSeries | null> {
    await this.initialize();
    return this.recurrenceSeries.get(id) ?? null;
  }

  async saveCompletedItem(item: CompletedItem): Promise<void> {
    await this.initialize();
    this.completedItems.set(item.id, item);
  }

  async getCompletedItem(id: EntityId): Promise<CompletedItem | null> {
    await this.initialize();
    return this.completedItems.get(id) ?? null;
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
      completedItems: new Map(this.completedItems),
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
      replaceMap(this.completedItems, snapshot.completedItems);
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
    for (const [id, item] of this.completedItems) {
      if (item.taskItemId === taskItemId) {
        this.completedItems.delete(id);
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
