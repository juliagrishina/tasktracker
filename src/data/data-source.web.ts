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

  async saveReminder(reminder: Reminder): Promise<void> {
    await this.initialize();
    assertReminderShape(reminder);
    this.reminders.set(reminder.id, reminder);
  }

  async getReminder(id: EntityId): Promise<Reminder | null> {
    await this.initialize();
    return this.reminders.get(id) ?? null;
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

  debugSettingsRowCount(): number {
    return this.settings === null ? 0 : 1;
  }
}

export function createInMemoryDataSource(): InMemoryDataSource {
  return new BrowserInMemoryDataSource();
}

export function createDataSource(): AppDataSource {
  return createInMemoryDataSource();
}
