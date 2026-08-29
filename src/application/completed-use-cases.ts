import type { AppDataSource } from '../data/contracts';
import type { EntityId } from '../domain/entities';
import { getDateInTimeZone } from '../domain/planning';

export type CompletedItemKind = 'project' | 'reminder' | 'task' | 'subtask';
export type CompletedPeriod = 'today' | 'week' | 'month' | 'year';

export interface CompletedItem {
  id: EntityId;
  kind: CompletedItemKind;
  title: string;
  completedAt: string;
  occurrence: { seriesId: EntityId; occursOn: string } | null;
  taskId?: EntityId;
}

export interface GetCompletedItemsOptions {
  now?: Date;
  period?: CompletedPeriod;
}

function addCalendarDays(isoDate: string, amount: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function isInCompletedPeriod(completedAt: string, period: CompletedPeriod, now: Date, timeZoneId: string): boolean {
  const completedOn = getDateInTimeZone(completedAt, timeZoneId);
  const today = getDateInTimeZone(now.toISOString(), timeZoneId);
  if (period === 'today') return completedOn === today;
  if (period === 'month') return completedOn.slice(0, 7) === today.slice(0, 7);
  if (period === 'year') return completedOn.slice(0, 4) === today.slice(0, 4);

  const currentDay = new Date(`${today}T00:00:00.000Z`).getUTCDay() || 7;
  const weekStartsOn = addCalendarDays(today, 1 - currentDay);
  const weekEndsOn = addCalendarDays(weekStartsOn, 6);
  return completedOn >= weekStartsOn && completedOn <= weekEndsOn;
}

export async function getCompletedItems(source: AppDataSource, options: GetCompletedItemsOptions = {}): Promise<readonly CompletedItem[]> {
  const [projects, reminders, tasks, series] = await Promise.all([
    source.listProjects(),
    source.listReminders(),
    source.listTaskItems(),
    source.listRecurrenceSeries(),
  ]);
  const result: CompletedItem[] = [
    ...projects.filter((item) => item.completedAt !== null).map((item) => ({ id: item.id, kind: 'project' as const, title: item.title, completedAt: item.completedAt!, occurrence: null })),
    ...reminders.filter((item) => item.completedAt !== null).map((item) => ({ id: item.id, kind: 'reminder' as const, title: item.title, completedAt: item.completedAt!, occurrence: null })),
    ...tasks.filter((item) => item.completedAt !== null).map((item) => ({ id: item.id, kind: item.kind, title: item.title, completedAt: item.completedAt!, occurrence: null })),
  ];
  for (const recurrence of series) {
    const task = recurrence.itemKind === 'task'
      ? tasks.find((candidate) => candidate.id === recurrence.itemId)
      : undefined;
    const reminder = recurrence.itemKind === 'reminder'
      ? reminders.find((candidate) => candidate.id === recurrence.itemId)
      : undefined;
    if (task === undefined && reminder === undefined) continue;
    for (const occurrence of await source.listRecurrenceOccurrences(recurrence.id)) {
      if (occurrence.completedAt === null) continue;
      result.push({
        id: `recurrence:${recurrence.id}:${occurrence.occursOn}`,
        kind: task?.kind ?? 'reminder',
        title: task === undefined
          ? occurrence.reminderPatch?.title ?? reminder!.title
          : occurrence.taskPatch?.title ?? task.title,
        completedAt: occurrence.completedAt,
        occurrence: { seriesId: recurrence.id, occursOn: occurrence.occursOn },
        ...(task === undefined ? {} : { taskId: recurrence.itemId }),
      });
    }
  }
  if (options.period === undefined) {
    return result.sort((left, right) => right.completedAt.localeCompare(left.completedAt) || left.title.localeCompare(right.title, 'ru'));
  }
  const settings = await source.getSettings();
  const filtered = result.filter((item) => isInCompletedPeriod(item.completedAt, options.period!, options.now ?? new Date(), settings.timeZoneId));
  return filtered.sort((left, right) => right.completedAt.localeCompare(left.completedAt) || left.title.localeCompare(right.title, 'ru'));
}
