import type { EntityId, TaskItem } from '../domain/entities';
import { createTaskFromReminder } from '../domain/reminder-conversion';
import type { AppDataSource } from '../data/contracts';

export interface ConvertReminderToTaskInput {
  reminderId: EntityId;
  taskId: EntityId;
  createdAt: string;
}

export async function convertReminderToTask(
  source: AppDataSource,
  input: ConvertReminderToTaskInput,
): Promise<TaskItem> {
  let task: TaskItem | null = null;

  await source.transaction(async () => {
    const reminder = await source.getReminder(input.reminderId);

    if (reminder === null) {
      throw new Error('Напоминание для преобразования не найдено');
    }

    task = createTaskFromReminder(reminder, input.taskId, input.createdAt);
    await source.saveTaskItem(task);
    await source.deleteReminder(reminder.id);
  });

  if (task === null) {
    throw new Error('Не удалось преобразовать напоминание в задачу');
  }

  return task;
}
