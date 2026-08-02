import type { AppSettings, EntityId, Project, TaskItem } from '../domain/entities';

export interface AppDataSource {
  initialize(): Promise<void>;
  getSettings(): Promise<AppSettings>;
  saveProject(project: Project): Promise<void>;
  getProject(id: EntityId): Promise<Project | null>;
  saveTaskItem(task: TaskItem): Promise<void>;
  getTaskItem(id: EntityId): Promise<TaskItem | null>;
}
