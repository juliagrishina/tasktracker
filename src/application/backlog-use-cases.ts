import type { AppDataSource } from '../data/contracts';
import { recordEvent, type EventEntityType } from '../data/events-client';
import {
  assertBacklogTitle,
  assertEstimatedDuration,
  assertReminderScheduleShape,
} from '../domain/backlog-invariants';
import type { EntityId, Project, Reminder, TaskItem } from '../domain/entities';

import { cancelScheduleBlockNotification, type LocalNotificationScheduler } from './notification-scheduling';

import type {
  BacklogItemKind,
  BacklogProjectTree,
  BacklogSubtask,
  BacklogTask,
  BacklogTaskTree,
  BacklogView,
  CompleteBacklogItemInput,
  CreateProjectInput,
  CreateReminderInput,
  CreateSubtaskInput,
  CreateTaskInput,
  DeleteBacklogItemInput,
  MoveTaskToProjectInput,
  UpdateProjectInput,
  UpdateReminderInput,
  UpdateTaskItemInput,
} from './backlog-types';

const backlogCategoryOrder = ['reminders', 'unassigned', 'projects'] as const;
const russianCollator = new Intl.Collator('ru');

async function cancelTaskNotifications(source: AppDataSource, taskIds: readonly EntityId[], scheduler?: LocalNotificationScheduler): Promise<void> {
  if (scheduler === undefined) return;
  const ids = new Set(taskIds);
  for (const block of await source.listScheduleBlocks()) {
    if (ids.has(block.taskItemId)) await cancelScheduleBlockNotification(scheduler, block);
  }
}

function compareByCreatedAt<T extends { id: EntityId; createdAt: string }>(
  left: T,
  right: T,
): number {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function compareProjects(left: Project, right: Project): number {
  return (
    russianCollator.compare(left.title, right.title) ||
    compareByCreatedAt(left, right)
  );
}

function normalizeTitle(title: string): string {
  assertBacklogTitle(title);
  return title.trim();
}

function normalizeDescription(description: string | null | undefined): string | null {
  const normalized = description?.trim() ?? '';
  return normalized.length === 0 ? null : normalized;
}

function normalizeDuration(value: number | null | undefined): number | null {
  const duration = value ?? null;
  assertEstimatedDuration(duration);
  return duration;
}

function entityTypeForBacklogKind(kind: BacklogItemKind): EventEntityType {
  if (kind === 'project') {
    return 'project';
  }

  if (kind === 'reminder') {
    return 'reminder';
  }

  return 'task_item';
}

function setCompletedAt<T extends { completedAt: string | null }>(
  item: T,
  completedAt: string,
): T {
  return item.completedAt === null ? { ...item, completedAt } : item;
}

function isBacklogTask(task: TaskItem, scheduledTaskIds: ReadonlySet<EntityId>): boolean {
  return task.completedAt === null && !scheduledTaskIds.has(task.id);
}

function asTask(task: TaskItem): BacklogTask | null {
  return task.kind === 'task' ? task : null;
}

function asSubtask(task: TaskItem): BacklogSubtask | null {
  return task.kind === 'subtask' ? task : null;
}

function buildTaskTrees(
  tasks: readonly TaskItem[],
  projectId: EntityId | null,
  scheduledTaskIds: ReadonlySet<EntityId>,
): readonly BacklogTaskTree[] {
  const activeTasks = tasks.filter((task) => isBacklogTask(task, scheduledTaskIds));

  return activeTasks
    .filter((task) => task.kind === 'task' && task.projectId === projectId)
    .map((task) => {
      const rootTask = asTask(task);

      if (rootTask === null) {
        throw new Error('Невозможно построить дерево незадачи');
      }

      return {
        task: rootTask,
        subtasks: activeTasks
          .filter(
            (candidate) =>
              candidate.kind === 'subtask' && candidate.parentTaskId === rootTask.id,
          )
          .map(asSubtask)
          .filter((subtask): subtask is BacklogSubtask => subtask !== null)
          .sort(compareByCreatedAt),
      };
    })
    .sort((left, right) => compareByCreatedAt(left.task, right.task));
}

async function getExistingProject(source: AppDataSource, id: EntityId): Promise<Project> {
  const project = await source.getProject(id);

  if (project === null) {
    throw new Error('Проект не найден');
  }

  return project;
}

async function getExistingTaskItem(source: AppDataSource, id: EntityId): Promise<TaskItem> {
  const item = await source.getTaskItem(id);

  if (item === null) {
    throw new Error('Задача не найдена');
  }

  return item;
}

async function getExistingReminder(source: AppDataSource, id: EntityId): Promise<Reminder> {
  const reminder = await source.getReminder(id);

  if (reminder === null) {
    throw new Error('Напоминание не найдено');
  }

  return reminder;
}

export async function createProject(
  source: AppDataSource,
  input: CreateProjectInput,
): Promise<Project> {
  const project: Project = {
    id: input.id,
    title: normalizeTitle(input.title),
    description: normalizeDescription(input.description),
    completedAt: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    deletedAt: null,
  };

  await source.saveProject(project);
  void recordEvent({ entityType: 'project', entityId: project.id, eventType: 'task_created' });
  return project;
}

export async function createTask(
  source: AppDataSource,
  input: CreateTaskInput,
): Promise<BacklogTask> {
  const projectId = input.projectId ?? null;

  if (projectId !== null) {
    await getExistingProject(source, projectId);
  }

  const task: BacklogTask = {
    id: input.id,
    kind: 'task',
    projectId,
    parentTaskId: null,
    title: normalizeTitle(input.title),
    description: normalizeDescription(input.description),
    estimatedDurationMinutes: normalizeDuration(input.estimatedDurationMinutes),
    completedAt: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    deletedAt: null,
  };

  await source.saveTaskItem(task);
  void recordEvent({ entityType: 'task_item', entityId: task.id, eventType: 'task_created' });
  return task;
}

export async function createSubtask(
  source: AppDataSource,
  input: CreateSubtaskInput,
): Promise<BacklogSubtask> {
  const parent = await getExistingTaskItem(source, input.parentTaskId);

  if (parent.kind !== 'task') {
    throw new Error('Родителем подзадачи может быть только задача');
  }

  const subtask: BacklogSubtask = {
    id: input.id,
    kind: 'subtask',
    projectId: parent.projectId,
    parentTaskId: parent.id,
    title: normalizeTitle(input.title),
    description: normalizeDescription(input.description),
    estimatedDurationMinutes: normalizeDuration(input.estimatedDurationMinutes),
    completedAt: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    deletedAt: null,
  };

  await source.saveTaskItem(subtask);
  void recordEvent({ entityType: 'task_item', entityId: subtask.id, eventType: 'task_created' });
  return subtask;
}

export async function createReminder(
  source: AppDataSource,
  input: CreateReminderInput,
): Promise<Reminder> {
  const reminder: Reminder = {
    id: input.id,
    title: normalizeTitle(input.title),
    remindsOn: input.remindsOn ?? null,
    periodStartOn: input.periodStartOn ?? null,
    periodEndOn: input.periodEndOn ?? null,
    repeatRule: input.repeatRule ?? null,
    estimatedDurationMinutes: normalizeDuration(input.estimatedDurationMinutes),
    completedAt: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    deletedAt: null,
  };

  assertReminderScheduleShape(reminder);
  await source.saveReminder(reminder);
  void recordEvent({ entityType: 'reminder', entityId: reminder.id, eventType: 'task_created' });
  return reminder;
}

export async function updateProject(
  source: AppDataSource,
  input: UpdateProjectInput,
): Promise<Project> {
  const current = await getExistingProject(source, input.id);
  const project: Project = {
    ...current,
    title: input.title === undefined ? current.title : normalizeTitle(input.title),
    description:
      input.description === undefined
        ? current.description
        : normalizeDescription(input.description),
  };

  await source.saveProject(project);
  return project;
}

export async function updateTaskItem(
  source: AppDataSource,
  input: UpdateTaskItemInput,
): Promise<TaskItem> {
  const current = await getExistingTaskItem(source, input.id);
  const task: TaskItem = {
    ...current,
    title: input.title === undefined ? current.title : normalizeTitle(input.title),
    description:
      input.description === undefined
        ? current.description
        : normalizeDescription(input.description),
    estimatedDurationMinutes:
      input.estimatedDurationMinutes === undefined
        ? current.estimatedDurationMinutes
        : normalizeDuration(input.estimatedDurationMinutes),
  };

  await source.saveTaskItem(task);
  return task;
}

export async function updateReminder(
  source: AppDataSource,
  input: UpdateReminderInput,
): Promise<Reminder> {
  const current = await getExistingReminder(source, input.id);
  const reminder: Reminder = {
    ...current,
    title: input.title === undefined ? current.title : normalizeTitle(input.title),
    remindsOn: input.remindsOn === undefined ? current.remindsOn : input.remindsOn,
    periodStartOn:
      input.periodStartOn === undefined ? current.periodStartOn : input.periodStartOn,
    periodEndOn: input.periodEndOn === undefined ? current.periodEndOn : input.periodEndOn,
    repeatRule: input.repeatRule === undefined ? current.repeatRule : input.repeatRule,
    estimatedDurationMinutes:
      input.estimatedDurationMinutes === undefined
        ? current.estimatedDurationMinutes
        : normalizeDuration(input.estimatedDurationMinutes),
  };

  assertReminderScheduleShape(reminder);
  await source.saveReminder(reminder);
  return reminder;
}

export async function getBacklogView(source: AppDataSource): Promise<BacklogView> {
  const [projects, taskItems, reminders, scheduleBlocks] = await Promise.all([
    source.listProjects(),
    source.listTaskItems(),
    source.listReminders(),
    source.listScheduleBlocks(),
  ]);
  const scheduledTaskIds = new Set([
    ...scheduleBlocks.map((block) => block.taskItemId),
    ...taskItems.filter((task) => task.scheduledOn !== null && task.scheduledOn !== undefined || task.periodStartOn !== null && task.periodStartOn !== undefined).map((task) => task.id),
  ]);

  const projectsView: readonly BacklogProjectTree[] = projects
    .filter((project) => project.completedAt === null)
    .sort(compareProjects)
    .map((project) => ({
      project,
      tasks: buildTaskTrees(taskItems, project.id, scheduledTaskIds),
    }));

  return {
    categoryOrder: backlogCategoryOrder,
    reminders: reminders
      .filter((reminder) => reminder.completedAt === null && reminder.remindsOn === null)
      .sort(compareByCreatedAt),
    unassignedTasks: buildTaskTrees(taskItems, null, scheduledTaskIds),
    projects: projectsView,
  };
}

export async function moveTaskToProject(
  source: AppDataSource,
  input: MoveTaskToProjectInput,
): Promise<void> {
  await source.transaction(async () => {
    const task = await getExistingTaskItem(source, input.taskId);

    if (task.kind !== 'task') {
      throw new Error('Перемещать между проектами можно только задачу');
    }

    if (input.projectId !== null) {
      const project = await getExistingProject(source, input.projectId);

      if (project.completedAt !== null) {
        throw new Error('Нельзя добавить задачу в завершённый проект');
      }
    }

    const allItems = await source.listTaskItems();
    const relatedItems = allItems.filter(
      (item) => item.id === task.id || item.parentTaskId === task.id,
    );

    await Promise.all(
      relatedItems.map((item) => source.saveTaskItem({ ...item, projectId: input.projectId })),
    );
  });
}

export async function completeBacklogItem(
  source: AppDataSource,
  input: CompleteBacklogItemInput,
  scheduler?: LocalNotificationScheduler,
): Promise<void> {
  const related = await source.listTaskItems();
  const taskIds = input.kind === 'project'
    ? related.filter((item) => item.projectId === input.id).map((item) => item.id)
    : input.kind === 'task'
      ? related.filter((item) => item.id === input.id || item.parentTaskId === input.id).map((item) => item.id)
      : input.kind === 'subtask' ? [input.id] : [];
  await cancelTaskNotifications(source, taskIds, scheduler);
  await source.transaction(async () => {
    if (input.kind === 'project') {
      const project = await getExistingProject(source, input.id);
      const items = await source.listTaskItems();

      await source.saveProject(setCompletedAt(project, input.completedAt));
      await Promise.all(
        items
          .filter((item) => item.projectId === project.id)
          .map((item) => source.saveTaskItem(setCompletedAt(item, input.completedAt))),
      );
      return;
    }

    if (input.kind === 'reminder') {
      const reminder = await getExistingReminder(source, input.id);
      await source.saveReminder(setCompletedAt(reminder, input.completedAt));
      return;
    }

    const item = await getExistingTaskItem(source, input.id);

    if (item.kind !== input.kind) {
      throw new Error('Тип элемента не совпадает');
    }

    if (item.kind === 'subtask') {
      await source.saveTaskItem(setCompletedAt(item, input.completedAt));
      return;
    }

    const items = await source.listTaskItems();
    await Promise.all(
      items
        .filter(
          (candidate) =>
            candidate.id === item.id || candidate.parentTaskId === item.id,
        )
        .map((candidate) => source.saveTaskItem(setCompletedAt(candidate, input.completedAt))),
    );
  });

  void recordEvent({
    entityType: entityTypeForBacklogKind(input.kind),
    entityId: input.id,
    eventType: 'task_completed',
  });
}

export async function deleteBacklogItem(
  source: AppDataSource,
  input: DeleteBacklogItemInput,
  scheduler?: LocalNotificationScheduler,
): Promise<void> {
  if (!input.confirmed) {
    throw new Error('Требуется подтверждение удаления');
  }

  const related = await source.listTaskItems();
  const taskIds = input.kind === 'task'
    ? related.filter((item) => item.id === input.id || item.parentTaskId === input.id).map((item) => item.id)
    : input.kind === 'subtask' ? [input.id] : [];
  await cancelTaskNotifications(source, taskIds, scheduler);

  await source.transaction(async () => {
    if (input.kind === 'project') {
      await getExistingProject(source, input.id);
      await source.deleteProject(input.id);
      return;
    }

    if (input.kind === 'reminder') {
      await getExistingReminder(source, input.id);
      await source.deleteReminder(input.id);
      return;
    }

    const item = await getExistingTaskItem(source, input.id);

    if (item.kind !== input.kind) {
      throw new Error('Тип элемента не совпадает');
    }

    await source.deleteTaskItem(input.id);
  });

  void recordEvent({
    entityType: entityTypeForBacklogKind(input.kind),
    entityId: input.id,
    eventType: 'task_deleted',
  });
}

export type {
  BacklogItemKind,
  BacklogProjectTree,
  BacklogSubtask,
  BacklogTask,
  BacklogTaskTree,
  BacklogView,
  CompleteBacklogItemInput,
  CreateProjectInput,
  CreateReminderInput,
  CreateSubtaskInput,
  CreateTaskInput,
  DeleteBacklogItemInput,
  MoveTaskToProjectInput,
  UpdateProjectInput,
  UpdateReminderInput,
  UpdateTaskItemInput,
};
