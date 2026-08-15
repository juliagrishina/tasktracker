import type { EntityId, TaskItem } from '../domain/entities';
import { createTaskFromReminder } from '../domain/reminder-conversion';
import type { AppDataSource } from '../data/contracts';
import { recordEvent } from '../data/events-client';

export interface ConvertReminderToTaskInput {
  reminderId: EntityId;
  taskId: EntityId;
  createdAt: string;
}

export async function convertReminderToTask(
  source: AppDataSource,
  input: ConvertReminderToTaskInput,
): Promise<TaskItem> {
  const reminder = await source.getReminder(input.reminderId);

  if (reminder === null) {
    throw new Error('Напоминание для преобразования не найдено');
  }

  const task = createTaskFromReminder(reminder, input.taskId, input.createdAt);
  await source.saveTaskItem(task);
  await source.deleteReminder(reminder.id);

  void recordEvent({
    entityType: 'task_item',
    entityId: task.id,
    eventType: 'reminder_converted_to_task',
    payload: { reminderId: reminder.id },
  });

  return task;
}
