import type { EntityId, Project, Reminder, TaskItem } from '../domain/entities';

export type BacklogItemKind = 'project' | 'task' | 'subtask' | 'reminder';

export type BacklogTask = Extract<TaskItem, { kind: 'task' }>;
export type BacklogSubtask = Extract<TaskItem, { kind: 'subtask' }>;

export interface BacklogTaskTree {
  task: BacklogTask;
  subtasks: readonly BacklogSubtask[];
}

export interface BacklogProjectTree {
  project: Project;
  tasks: readonly BacklogTaskTree[];
}

export interface BacklogView {
  categoryOrder: readonly ['reminders', 'unassigned', 'projects'];
  reminders: readonly Reminder[];
  unassignedTasks: readonly BacklogTaskTree[];
  projects: readonly BacklogProjectTree[];
}

export interface CreateProjectInput {
  id: EntityId;
  title: string;
  description?: string | null;
  createdAt: string;
}

export interface CreateTaskInput {
  id: EntityId;
  title: string;
  projectId?: EntityId | null;
  description?: string | null;
  estimatedDurationMinutes?: number | null;
  createdAt: string;
}

export interface CreateSubtaskInput {
  id: EntityId;
  parentTaskId: EntityId;
  title: string;
  description?: string | null;
  estimatedDurationMinutes?: number | null;
  createdAt: string;
}

export interface CreateReminderInput {
  id: EntityId;
  title: string;
  linkedTaskItemId?: EntityId | null;
  linkedOccurrenceOn?: string | null;
  remindsOn?: string | null;
  periodStartOn?: string | null;
  periodEndOn?: string | null;
  repeatRule?: Reminder['repeatRule'];
  estimatedDurationMinutes?: number | null;
  createdAt: string;
}

export interface CreateFollowUpReminderInput {
  id: EntityId;
  taskItemId: EntityId;
  taskTitle: string;
  linkedOccurrenceOn: string | null;
  remindsOn: string;
  createdAt: string;
}

export interface UpdateProjectInput {
  id: EntityId;
  title?: string;
  description?: string | null;
}

export interface UpdateTaskItemInput {
  id: EntityId;
  title?: string;
  description?: string | null;
  estimatedDurationMinutes?: number | null;
}

export interface UpdateReminderInput {
  id: EntityId;
  title?: string;
  remindsOn?: string | null;
  periodStartOn?: string | null;
  periodEndOn?: string | null;
  repeatRule?: Reminder['repeatRule'];
  estimatedDurationMinutes?: number | null;
}

export interface MoveTaskToProjectInput {
  taskId: EntityId;
  projectId: EntityId | null;
}

export interface CompleteBacklogItemInput {
  kind: BacklogItemKind;
  id: EntityId;
  completedAt: string;
}

export interface ResumeBacklogItemInput {
  kind: BacklogItemKind;
  id: EntityId;
}

export interface DeleteBacklogItemInput {
  kind: BacklogItemKind;
  id: EntityId;
  confirmed: boolean;
}
