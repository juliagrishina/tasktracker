import type { AppDataSource } from '../data/contracts';
import type { EntityId } from '../domain/entities';
import { getDateInTimeZone } from '../domain/planning';
import type { LocalNotificationScheduler } from './notification-scheduling';
import { deleteBacklogItem } from './backlog-use-cases';
import { setRecurrenceOccurrenceState } from './planning-use-cases';

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

export interface CompletedItemDetails {
  item: CompletedItem;
  typeLabel: 'Проект' | 'Задача' | 'Подзадача' | 'Напоминание';
  description: string | null;
  relation: { label: 'Проект' | 'Родительская задача' | 'Связанная задача'; title: string } | null;
  completionContext: string;
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

export async function getCompletedItemDetails(source: AppDataSource, item: CompletedItem): Promise<CompletedItemDetails | null> {
  if (item.kind === 'project') {
    const project = await source.getProject(item.id);
    return project === null ? null : createDetails(item, 'Проект', project.description, null);
  }

  if (item.kind === 'reminder') {
    const reminder = await getReminderForCompletedItem(source, item);
    if (reminder === null) return null;
    const linkedTask = reminder.linkedTaskItemId === null || reminder.linkedTaskItemId === undefined
      ? null
      : await source.getTaskItem(reminder.linkedTaskItemId);
    return createDetails(item, 'Напоминание', null, linkedTask === null ? null : { label: 'Связанная задача', title: linkedTask.title });
  }

  const task = await getTaskForCompletedItem(source, item);
  if (task === null) return null;
  const occurrence = item.occurrence === null
    ? null
    : (await source.listRecurrenceOccurrences(item.occurrence.seriesId)).find((candidate) => candidate.occursOn === item.occurrence!.occursOn) ?? null;
  const description = occurrence?.taskPatch?.description ?? task.description;
  if (task.kind === 'subtask') {
    const parentTask = await source.getTaskItem(task.parentTaskId);
    return createDetails(item, 'Подзадача', description, parentTask === null ? null : { label: 'Родительская задача', title: parentTask.title });
  }
  const project = task.projectId === null ? null : await source.getProject(task.projectId);
  return createDetails(item, 'Задача', description, project === null ? null : { label: 'Проект', title: project.title });
}

export async function permanentlyDeleteCompletedItem(source: AppDataSource, item: CompletedItem, scheduler?: LocalNotificationScheduler): Promise<void> {
  if (item.occurrence !== null) {
    const occurrence = (await source.listRecurrenceOccurrences(item.occurrence.seriesId)).find((candidate) => candidate.occursOn === item.occurrence!.occursOn);
    if (occurrence === undefined || occurrence.completedAt === null) throw new Error('Завершённый экземпляр не найден');
    await setRecurrenceOccurrenceState(source, item.occurrence.seriesId, item.occurrence.occursOn, 'cancelled', scheduler);
    return;
  }

  if (!await isCompletedArchiveItem(source, item)) throw new Error('Можно удалить только завершённый элемент');
  await deleteBacklogItem(source, { kind: item.kind, id: item.id, confirmed: true }, scheduler);
}

export async function permanentlyDeleteCompletedSeries(source: AppDataSource, item: CompletedItem, scheduler?: LocalNotificationScheduler): Promise<void> {
  if (item.occurrence === null) throw new Error('Серия повторения не найдена');
  const [series, occurrence] = await Promise.all([
    source.getRecurrenceSeries(item.occurrence.seriesId),
    source.listRecurrenceOccurrences(item.occurrence.seriesId).then((occurrences) => occurrences.find((candidate) => candidate.occursOn === item.occurrence!.occursOn)),
  ]);
  if (series === null || occurrence === undefined || occurrence.completedAt === null) throw new Error('Завершённый экземпляр не найден');
  if (series.itemKind === 'reminder') {
    await deleteBacklogItem(source, { kind: 'reminder', id: series.itemId, confirmed: true }, scheduler);
    return;
  }
  const task = await source.getTaskItem(series.itemId);
  if (task === null) throw new Error('Задача серии не найдена');
  await deleteBacklogItem(source, { kind: task.kind, id: task.id, confirmed: true }, scheduler);
}

function createDetails(
  item: CompletedItem,
  typeLabel: CompletedItemDetails['typeLabel'],
  description: string | null,
  relation: CompletedItemDetails['relation'],
): CompletedItemDetails {
  return {
    item,
    typeLabel,
    description,
    relation,
    completionContext: item.occurrence === null ? 'Обычное завершение' : `Экземпляр серии от ${item.occurrence.occursOn}`,
  };
}

async function getTaskForCompletedItem(source: AppDataSource, item: CompletedItem) {
  if (item.taskId !== undefined) return source.getTaskItem(item.taskId);
  if (item.occurrence === null) return source.getTaskItem(item.id);
  const series = await source.getRecurrenceSeries(item.occurrence.seriesId);
  return series === null ? null : source.getTaskItem(series.itemId);
}

async function getReminderForCompletedItem(source: AppDataSource, item: CompletedItem) {
  if (item.occurrence === null) return source.getReminder(item.id);
  const series = await source.getRecurrenceSeries(item.occurrence.seriesId);
  return series === null ? null : source.getReminder(series.itemId);
}

async function isCompletedArchiveItem(source: AppDataSource, item: CompletedItem): Promise<boolean> {
  if (item.kind === 'project') return (await source.getProject(item.id))?.completedAt != null;
  if (item.kind === 'reminder') return (await source.getReminder(item.id))?.completedAt != null;
  return (await source.getTaskItem(item.id))?.completedAt != null;
}
