import type { EntityId, Reminder, TaskItem } from './entities';

export function createTaskFromReminder(
  reminder: Reminder,
  taskId: EntityId,
  createdAt: string,
): TaskItem {
  return {
    id: taskId,
    kind: 'task',
    projectId: null,
    parentTaskId: null,
    title: reminder.title,
    createdAt,
  };
}
