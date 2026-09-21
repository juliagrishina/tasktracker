import type { AppDataSource } from '../data/contracts';
import type { AppSettings } from '../domain/entities';

import { synchronizeEveningReviewNotification } from './evening-review';
import { synchronizeScheduleBlockNotification, type LocalNotificationScheduler } from './notification-scheduling';
import { synchronizeRecurrenceNotifications } from './planning-use-cases';

export interface UpdatePlanningSettingsInput {
  workdayStartsAt: string;
  workdayEndsAt: string;
  eveningReviewAt: string;
  notificationLeadMinutes: number;
}

function getMinutesSinceMidnight(value: string, fieldName: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new Error(`${fieldName} должно быть указано в формате ЧЧ:ММ`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function assertPlanningSettings(input: UpdatePlanningSettingsInput): void {
  const workdayStartsAt = getMinutesSinceMidnight(input.workdayStartsAt, 'Время начала рабочего дня');
  const workdayEndsAt = getMinutesSinceMidnight(input.workdayEndsAt, 'Время окончания рабочего дня');
  getMinutesSinceMidnight(input.eveningReviewAt, 'Время вечерней проверки');
  if (workdayEndsAt <= workdayStartsAt) {
    throw new Error('Время окончания рабочего дня должно быть позже времени начала');
  }
  if (!Number.isInteger(input.notificationLeadMinutes) || input.notificationLeadMinutes < 0) {
    throw new Error('Интервал уведомления должен быть целым числом от нуля');
  }
}

async function synchronizeOneTimeBlockNotifications(
  source: AppDataSource,
  settings: AppSettings,
  scheduler: LocalNotificationScheduler,
  now: Date,
): Promise<void> {
  const [blocks, tasks, series] = await Promise.all([
    source.listScheduleBlocks(),
    source.listTaskItems(),
    source.listRecurrenceSeries(),
  ]);
  const recurringTaskIds = new Set(series.filter((candidate) => candidate.itemKind === 'task').map((candidate) => candidate.itemId));
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  for (const block of blocks) {
    if (block.occurrenceId !== null || recurringTaskIds.has(block.taskItemId)) continue;
    const task = taskById.get(block.taskItemId);
    if (task === undefined || task.completedAt !== null) continue;
    const updatedBlock = await synchronizeScheduleBlockNotification({
      block,
      displayTimeZoneId: settings.timeZoneId,
      notificationLeadMinutes: settings.notificationLeadMinutes,
      now,
      scheduler,
      taskTitle: task.title,
    });
    await source.saveScheduleBlock(updatedBlock);
  }
}

/**
 * Stores the user-controlled planning parameters and applies them to all
 * notifications that have not fired yet. Recurrent blocks are rebuilt by the
 * recurrence synchronizer; standalone blocks are recreated individually.
 */
export async function updatePlanningSettings(
  source: AppDataSource,
  input: UpdatePlanningSettingsInput,
  scheduler?: LocalNotificationScheduler,
  now = new Date(),
): Promise<AppSettings> {
  assertPlanningSettings(input);
  const current = await source.getSettings();
  const updated = { ...current, ...input };
  await source.saveSettings(updated);

  if (scheduler === undefined) return updated;

  await synchronizeOneTimeBlockNotifications(source, updated, scheduler, now);
  await synchronizeRecurrenceNotifications(source, scheduler, now);
  await synchronizeEveningReviewNotification({ source, scheduler, now });
  return source.getSettings();
}
