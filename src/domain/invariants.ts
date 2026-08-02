import type { Reminder, ScheduleBlock, TaskItem } from './entities';

import {
  assertBacklogTitle,
  assertEstimatedDuration,
  assertReminderScheduleShape,
} from './backlog-invariants';

export function assertTaskItemShape(task: TaskItem): void {
  if (task.kind === 'task' && task.parentTaskId !== null) {
    throw new Error('Задача верхнего уровня не может иметь родителя');
  }

  if (task.kind === 'subtask' && task.parentTaskId === null) {
    throw new Error('Подзадача должна ссылаться на задачу-родителя');
  }
}

export function assertTaskItemParent(
  task: TaskItem,
  parent: TaskItem | null,
): void {
  assertTaskItemShape(task);

  if (task.kind !== 'subtask') {
    return;
  }

  if (task.parentTaskId === task.id) {
    throw new Error('Подзадача не может быть собственным родителем');
  }

  if (parent === null) {
    throw new Error('Задача-родитель подзадачи не найдена');
  }

  if (parent.kind !== 'task') {
    throw new Error('Родителем подзадачи может быть только задача');
  }
}

export function assertReminderShape(reminder: Reminder): void {
  assertBacklogTitle(reminder.title);
  assertEstimatedDuration(reminder.estimatedDurationMinutes);
  assertReminderScheduleShape(reminder);
}

export function assertScheduleBlockShape(
  block: ScheduleBlock,
  task: TaskItem,
): void {
  if (block.taskItemId !== task.id) {
    throw new Error('Блок времени должен относиться к указанной задаче');
  }

  const startsAt = new Date(block.startsAt);
  const endsAt = new Date(block.endsAt);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error('Время блока должно быть корректной датой');
  }

  if (startsAt.getTime() >= endsAt.getTime()) {
    throw new Error('Окончание блока должно быть позже начала');
  }

  if (startsAt.getUTCMinutes() % 5 !== 0 || endsAt.getUTCMinutes() % 5 !== 0) {
    throw new Error('Время блока должно иметь шаг пять минут');
  }
}
