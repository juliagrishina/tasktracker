import * as SQLite from 'expo-sqlite';

import type { AppSettings, EntityId, Project, TaskItem } from '../domain/entities';
import { assertTaskItemShape } from '../domain/invariants';

import type { AppDataSource } from './contracts';
import { migrateDatabase } from './migrations';

interface SettingsRow {
  workday_starts_at: string;
  workday_ends_at: string;
  evening_review_at: string;
  notification_lead_minutes: number;
}

interface ProjectRow {
  id: string;
  title: string;
  created_at: string;
}

interface TaskItemRow {
  id: string;
  kind: 'task' | 'subtask';
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  created_at: string;
}

class NativeDataSource implements AppDataSource {
  private databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
  private initializationPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initializationPromise === null) {
      this.initializationPromise = this.initializeDatabase();
    }

    await this.initializationPromise;
  }

  async getSettings(): Promise<AppSettings> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<SettingsRow>(
      `SELECT
        workday_starts_at,
        workday_ends_at,
        evening_review_at,
        notification_lead_minutes
      FROM settings
      WHERE id = 1`,
    );

    if (row === null) {
      throw new Error('Не удалось загрузить настройки приложения');
    }

    return {
      workdayStartsAt: row.workday_starts_at,
      workdayEndsAt: row.workday_ends_at,
      eveningReviewAt: row.evening_review_at,
      notificationLeadMinutes: row.notification_lead_minutes,
    };
  }

  async saveProject(project: Project): Promise<void> {
    await this.initialize();
    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT OR REPLACE INTO projects (id, title, created_at)
      VALUES (?, ?, ?)`,
      [project.id, project.title, project.createdAt],
    );
  }

  async getProject(id: EntityId): Promise<Project | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<ProjectRow>(
      'SELECT id, title, created_at FROM projects WHERE id = ?',
      [id],
    );

    return row === null
      ? null
      : { id: row.id, title: row.title, createdAt: row.created_at };
  }

  async saveTaskItem(task: TaskItem): Promise<void> {
    await this.initialize();
    assertTaskItemShape(task);

    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT OR REPLACE INTO task_items (
        id,
        kind,
        project_id,
        parent_task_id,
        title,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.kind,
        task.projectId,
        task.parentTaskId,
        task.title,
        task.createdAt,
      ],
    );
  }

  async getTaskItem(id: EntityId): Promise<TaskItem | null> {
    await this.initialize();
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<TaskItemRow>(
      `SELECT id, kind, project_id, parent_task_id, title, created_at
      FROM task_items
      WHERE id = ?`,
      [id],
    );

    if (row === null) {
      return null;
    }

    if (row.kind === 'task') {
      return {
        id: row.id,
        kind: 'task',
        projectId: row.project_id,
        parentTaskId: null,
        title: row.title,
        createdAt: row.created_at,
      };
    }

    if (row.parent_task_id === null) {
      throw new Error('В хранилище обнаружена подзадача без родителя');
    }

    return {
      id: row.id,
      kind: 'subtask',
      projectId: row.project_id,
      parentTaskId: row.parent_task_id,
      title: row.title,
      createdAt: row.created_at,
    };
  }

  private async initializeDatabase(): Promise<void> {
    const database = await this.getDatabase();
    await migrateDatabase(database);
  }

  private getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (this.databasePromise === null) {
      this.databasePromise = SQLite.openDatabaseAsync('tasktracker.db');
    }

    return this.databasePromise;
  }
}

export function createDataSource(): AppDataSource {
  return new NativeDataSource();
}
