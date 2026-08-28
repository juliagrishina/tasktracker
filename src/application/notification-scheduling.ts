import type { ScheduleBlock } from '../domain/entities';
import { getTimeInTimeZone } from '../domain/planning';

export interface LocalNotificationScheduler {
  cancel(notificationId: string): Promise<void>;
  schedule(input: { body: string; scheduledAt: string; title: string }): Promise<string>;
}

export async function synchronizeScheduleBlockNotification(input: {
  block: ScheduleBlock;
  notificationLeadMinutes: number;
  now: Date;
  scheduler: LocalNotificationScheduler;
  taskTitle: string;
}): Promise<ScheduleBlock> {
  if (input.block.notificationId !== null && input.block.notificationId !== undefined) await input.scheduler.cancel(input.block.notificationId);
  const scheduledAt = new Date(new Date(input.block.startsAt).getTime() - input.notificationLeadMinutes * 60_000);
  if (scheduledAt <= input.now) return { ...input.block, notificationId: null };
  const notificationId = await input.scheduler.schedule({
    title: 'Скоро начнётся дело',
    body: `${input.taskTitle} начнётся в ${getTimeInTimeZone(input.block.startsAt, input.block.timeZoneId)}`,
    scheduledAt: scheduledAt.toISOString(),
  });
  return { ...input.block, notificationId };
}

export async function cancelScheduleBlockNotification(scheduler: LocalNotificationScheduler, block: ScheduleBlock): Promise<void> {
  if (block.notificationId !== null && block.notificationId !== undefined) await scheduler.cancel(block.notificationId);
}
