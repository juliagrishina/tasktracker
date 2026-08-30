import type { AppDataSource } from '../data/contracts';
import type { EntityId, RecurrenceOccurrence, TaskItem } from '../domain/entities';
import { getDateInTimeZone, getInstantInTimeZone, getRecurrenceDates } from '../domain/planning';

import { getPlanScheduleBlocks, getPlanUntimedReminders } from './planning-use-cases';
import type { LocalNotificationScheduler } from './notification-scheduling';

export interface EveningReviewItem {
  id: EntityId;
  kind: 'task' | 'reminder';
  title: string;
  occurrence: { seriesId: EntityId; occursOn: string } | null;
}

function hasPlacementOn(task: TaskItem, isoDate: string): boolean {
  return task.scheduledOn === isoDate
    || (task.periodStartOn !== null && task.periodStartOn !== undefined
      && task.periodEndOn !== null && task.periodEndOn !== undefined
      && task.periodStartOn <= isoDate && isoDate <= task.periodEndOn);
}

function isIncompleteOccurrence(occurrence: RecurrenceOccurrence | undefined): boolean {
  return occurrence?.cancelledAt === null || occurrence?.cancelledAt === undefined
    ? occurrence?.completedAt === null || occurrence?.completedAt === undefined
    : false;
}

function itemKey(item: EveningReviewItem): string {
  return `${item.kind}:${item.id}:${item.occurrence?.seriesId ?? 'single'}:${item.occurrence?.occursOn ?? 'single'}`;
}

function virtualOccurrence(blockOccurrenceId: string | null): { seriesId: string; occursOn: string } | null {
  const parts = blockOccurrenceId?.split(':');
  return parts?.[0] === 'virtual' && parts[1] !== undefined && parts[2] !== undefined
    ? { seriesId: parts[1], occursOn: parts[2] }
    : null;
}

export async function getEveningReviewItems(source: AppDataSource, isoDate: string): Promise<readonly EveningReviewItem[]> {
  const [tasks, blocks, series, exactBlocks, untimedReminders] = await Promise.all([
    source.listTaskItems(),
    source.listScheduleBlocks(),
    source.listRecurrenceSeries(),
    getPlanScheduleBlocks(source, isoDate),
    getPlanUntimedReminders(source, isoDate),
  ]);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const taskSeriesByItemId = new Map(series.filter((candidate) => candidate.itemKind === 'task').map((candidate) => [candidate.itemId, candidate]));
  const occurrencesBySeriesId = new Map<string, readonly RecurrenceOccurrence[]>();
  await Promise.all(series.map(async (candidate) => {
    occurrencesBySeriesId.set(candidate.id, await source.listRecurrenceOccurrences(candidate.id));
  }));
  const occurrenceById = new Map<string, RecurrenceOccurrence>();
  for (const occurrences of occurrencesBySeriesId.values()) for (const occurrence of occurrences) occurrenceById.set(occurrence.id, occurrence);

  const result: EveningReviewItem[] = [];
  const add = (item: EveningReviewItem) => {
    if (!result.some((candidate) => itemKey(candidate) === itemKey(item))) result.push(item);
  };

  for (const block of exactBlocks) {
    const task = taskById.get(block.taskItemId);
    if (task === undefined || task.completedAt !== null) continue;
    const series = taskSeriesByItemId.get(task.id);
    if (series === undefined) {
      add({ id: task.id, kind: 'task', title: task.title, occurrence: null });
      continue;
    }
    const virtual = virtualOccurrence(block.occurrenceId);
    const occurrence = virtual === null ? occurrenceById.get(block.occurrenceId ?? '') : occurrencesBySeriesId.get(virtual.seriesId)?.find((candidate) => candidate.occursOn === virtual.occursOn);
    const occurrenceDetails = virtual ?? (occurrence === undefined ? null : { seriesId: occurrence.seriesId, occursOn: occurrence.occursOn });
    if (occurrenceDetails !== null && isIncompleteOccurrence(occurrence)) add({ id: task.id, kind: 'task', title: occurrence?.taskPatch?.title ?? block.displayTaskPatch?.title ?? task.title, occurrence: occurrenceDetails });
  }

  const taskIdsWithExactTime = new Set(blocks.map((block) => block.taskItemId));
  for (const task of tasks) {
    if (task.completedAt !== null || taskIdsWithExactTime.has(task.id)) continue;
    const recurrence = taskSeriesByItemId.get(task.id);
    if (recurrence === undefined) {
      if (hasPlacementOn(task, isoDate)) add({ id: task.id, kind: 'task', title: task.title, occurrence: null });
      continue;
    }
    const occurrences = occurrencesBySeriesId.get(recurrence.id) ?? [];
    const occurrence = occurrences.find((candidate) => candidate.occursOn === isoDate);
    if (getRecurrenceDates(recurrence, isoDate, isoDate).includes(isoDate) && isIncompleteOccurrence(occurrence)) {
      add({ id: task.id, kind: 'task', title: occurrence?.taskPatch?.title ?? task.title, occurrence: { seriesId: recurrence.id, occursOn: isoDate } });
    }
    for (const moved of occurrences.filter((candidate) => candidate.taskPatch?.scheduledOn === isoDate && isIncompleteOccurrence(candidate))) {
      add({ id: task.id, kind: 'task', title: moved.taskPatch?.title ?? task.title, occurrence: { seriesId: recurrence.id, occursOn: moved.occursOn } });
    }
  }

  for (const reminder of untimedReminders) {
    const occurrence = reminder.seriesId === null || reminder.occursOn === null
      ? undefined
      : occurrencesBySeriesId.get(reminder.seriesId)?.find((candidate) => candidate.occursOn === reminder.occursOn);
    if (reminder.completedAt === null && isIncompleteOccurrence(occurrence)) {
      add({ id: reminder.id, kind: 'reminder', title: reminder.title, occurrence: reminder.seriesId === null || reminder.occursOn === null ? null : { seriesId: reminder.seriesId, occursOn: reminder.occursOn } });
    }
  }
  return result;
}

export async function synchronizeEveningReviewNotification(input: {
  now: Date;
  scheduler: LocalNotificationScheduler;
  source: AppDataSource;
}): Promise<void> {
  const settings = await input.source.getSettings();
  if (settings.eveningReviewNotificationId !== null && settings.eveningReviewNotificationId !== undefined) {
    await input.scheduler.cancel(settings.eveningReviewNotificationId);
  }
  const today = getDateInTimeZone(input.now.toISOString(), settings.timeZoneId);
  const scheduledAt = getInstantInTimeZone(today, settings.eveningReviewAt, settings.timeZoneId);
  const reviewItems = await getEveningReviewItems(input.source, today);
  if (new Date(scheduledAt) <= input.now || reviewItems.length === 0) {
    await input.source.saveSettings({ ...settings, eveningReviewNotificationId: null });
    return;
  }
  const notificationId = await input.scheduler.schedule({
    title: 'Вечерняя проверка',
    body: `Незавершённых дел: ${reviewItems.length}`,
    scheduledAt,
  });
  await input.source.saveSettings({ ...settings, eveningReviewNotificationId: notificationId });
}
