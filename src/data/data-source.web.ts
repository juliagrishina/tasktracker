import type { AppSettings, EntityId, Project, TaskItem } from '../domain/entities';
import { assertTaskItemShape } from '../domain/invariants';

import type { AppDataSource } from './contracts';
import { getDefaultSettings } from './default-settings';

export interface InMemoryDataSource extends AppDataSource {
  debugSettingsRowCount(): number;
}

class BrowserInMemoryDataSource implements InMemoryDataSource {
  private settings: AppSettings | null = null;
  private readonly projects = new Map<EntityId, Project>();
  private readonly taskItems = new Map<EntityId, TaskItem>();

  async initialize(): Promise<void> {
    if (this.settings === null) {
      this.settings = getDefaultSettings();
    }
  }

  async getSettings(): Promise<AppSettings> {
    await this.initialize();
    return this.settings ?? getDefaultSettings();
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
    assertTaskItemShape(task);
    this.taskItems.set(task.id, task);
  }

  async getTaskItem(id: EntityId): Promise<TaskItem | null> {
    await this.initialize();
    return this.taskItems.get(id) ?? null;
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
