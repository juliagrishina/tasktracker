import type { RecurrenceOccurrence, Reminder, ScheduleBlock, TaskItem } from './entities';

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

  if (block.timeZoneId !== null && block.timeZoneId !== undefined) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: block.timeZoneId }).format(startsAt);
    } catch {
      throw new Error('Invalid schedule block IANA time zone');
    }
  }

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

export function assertRecurrenceOccurrenceShape(occurrence: RecurrenceOccurrence): void {
  if (typeof occurrence.blocksOverridden !== 'boolean') {
    throw new Error('Recurrence block override flag must be boolean');
  }
  const completedAt = occurrence.completedAt;
  if (occurrence.status !== 'completed') {
    if (completedAt !== null && completedAt !== undefined) {
      throw new Error('Incomplete recurrence occurrence must not have completedAt');
    }
    return;
  }

  if (
    typeof completedAt !== 'string'
    || !/(Z|[+-]\d{2}:\d{2})$/.test(completedAt)
    || Number.isNaN(new Date(completedAt).getTime())
  ) {
    throw new Error('Completed recurrence occurrence requires a valid completion instant');
  }
}
