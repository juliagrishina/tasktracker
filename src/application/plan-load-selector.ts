import type { AppDataSource } from '../data/contracts';
import type {
  RecurrenceOccurrence,
  RecurrenceSeries,
  Reminder,
  ScheduleBlock,
  TaskItem,
} from '../domain/entities';
import {
  clipScheduleBlockToDate,
  doesScheduleBlockOverlapDate,
  getPlanLoadTone,
  getRecurrenceDates,
  type PlanLoadTone,
} from '../domain/planning';

import { getPlanLoad, getPlanScheduleBlocks } from './planning-use-cases';

export type PlanLoadMode = 'week' | 'month';

export interface PlanLoadDay {
  isoDate: string;
  dayOfMonth: number;
  weekdayLabel: string;
  loadPercent: number;
  tone: PlanLoadTone;
}

export interface DayPlanBlock {
  id: string;
  taskItemId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  sourceBlock?: ScheduleBlock;
  task?: TaskItem;
  occurrence?: DayPlanOccurrence;
}

export interface DayPlanOccurrence {
  id: string;
  seriesId: string;
  occursOn: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  startsOn: string;
}

export interface DayPlan {
  untimedTasks: readonly TaskItem[];
  untimedReminders: readonly Reminder[];
  blocks: readonly DayPlanBlock[];
  loadPercent: number;
  tone: PlanLoadTone;
}

const weekdayLabels = [
  'Воскресенье',
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
] as const;

function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(isoDate: string, days: number): string {
  const date = parseLocalDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function startOfWeek(isoDate: string): string {
  const date = parseLocalDate(isoDate);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return toIsoDate(date);
}

export function getPeriodDates(selectedDate: string, mode: PlanLoadMode): string[] {
  if (mode === 'week') {
    const weekStart = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }

  const selected = parseLocalDate(selectedDate);
  const daysInMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
  return Array.from(
    { length: daysInMonth },
    (_, index) => toIsoDate(new Date(selected.getFullYear(), selected.getMonth(), index + 1)),
  );
}

function toPlanLoadDay(isoDate: string, loadPercent: number): PlanLoadDay {
  const date = parseLocalDate(isoDate);
  return {
    isoDate,
    dayOfMonth: date.getDate(),
    weekdayLabel: weekdayLabels[date.getDay()],
    loadPercent,
    tone: getPlanLoadTone(loadPercent),
  };
}

export async function getPlanLoadDays(
  source: AppDataSource,
  selectedDate: string,
  mode: PlanLoadMode,
): Promise<readonly PlanLoadDay[]> {
  const isoDates = getPeriodDates(selectedDate, mode);
  const loadPercentages = await Promise.all(
    isoDates.map((isoDate) => getPlanLoad(source, isoDate)),
  );

  return isoDates.map((isoDate, index) => toPlanLoadDay(isoDate, loadPercentages[index]));
}

function matchesPlanDate(
  item: Pick<TaskItem, 'scheduledOn' | 'periodStartOn' | 'periodEndOn'>
    | Pick<Reminder, 'remindsOn' | 'periodStartOn' | 'periodEndOn'>,
  isoDate: string,
): boolean {
  const singleDate = 'scheduledOn' in item ? item.scheduledOn : item.remindsOn;
  if (singleDate === isoDate) {
    return true;
  }

  return item.periodStartOn !== null
    && item.periodEndOn !== null
    && item.periodStartOn <= isoDate
    && isoDate <= item.periodEndOn;
}

function matchesRecurringPlanDate(
  itemKind: 'task' | 'reminder',
  itemId: string,
  isoDate: string,
  recurrenceSeries: readonly RecurrenceSeries[],
  occurrencesBySeriesAndDate: ReadonlyMap<string, RecurrenceOccurrence>,
): boolean | undefined {
  const itemSeries = recurrenceSeries.filter((series) => (
    series.itemKind === itemKind && series.itemId === itemId
  ));
  if (itemSeries.length === 0) {
    return undefined;
  }

  return itemSeries.some((series) => {
    const [occursOn] = getRecurrenceDates(series, isoDate, isoDate);
    if (occursOn === undefined) {
      return false;
    }

    return occurrencesBySeriesAndDate.get(`${series.id}:${occursOn}`)?.status !== 'cancelled';
  });
}

export async function getDayPlan(source: AppDataSource, isoDate: string): Promise<DayPlan> {
  const [taskItems, reminders, scheduleBlocks, loadPercent, occurrences, recurrenceSeries] = await Promise.all([
    source.listTaskItems(),
    source.listReminders(),
    getPlanScheduleBlocks(source, isoDate),
    getPlanLoad(source, isoDate),
    source.listRecurrenceOccurrences(),
    source.listRecurrenceSeries(),
  ]);
  const activeTasks = taskItems.filter((task) => task.completedAt === null);
  const tasksById = new Map(activeTasks.map((task) => [task.id, task]));
  const occurrencesById = new Map(occurrences.map((occurrence) => [occurrence.id, occurrence]));
  const occurrencesBySeriesAndDate = new Map(
    occurrences.map((occurrence) => [`${occurrence.seriesId}:${occurrence.occursOn}`, occurrence]),
  );
  const taskSeries = recurrenceSeries.filter((series) => series.itemKind === 'task');
  const dayBlocks = scheduleBlocks
    .filter((block) => doesScheduleBlockOverlapDate(block, isoDate))
    .map((sourceBlock) => {
      const block = clipScheduleBlockToDate(sourceBlock, isoDate);
      if (block === null) {
        return null;
      }
      const task = tasksById.get(sourceBlock.taskItemId);
      const occurrence = sourceBlock.occurrenceId === null
        ? undefined
        : occurrencesById.get(sourceBlock.occurrenceId);
      const blockStartsOn = sourceBlock.startsAt.slice(0, 10);
      const series = occurrence === undefined
        ? taskSeries.find((candidate) => (
            candidate.itemId === sourceBlock.taskItemId
            && getRecurrenceDates(candidate, blockStartsOn, blockStartsOn).length === 1
          ))
        : taskSeries.find((candidate) => candidate.id === occurrence.seriesId);
      const occursOn = occurrence?.occursOn ?? (series === undefined ? undefined : blockStartsOn);
      const savedOccurrence = occurrence
        ?? (series === undefined || occursOn === undefined
          ? undefined
          : occurrencesBySeriesAndDate.get(`${series.id}:${occursOn}`));
      return {
        block,
        task: task === undefined || savedOccurrence?.taskPatch === undefined
          ? task
          : { ...task, ...savedOccurrence.taskPatch },
        occurrence: series === undefined || occursOn === undefined
          ? undefined
          : {
              id: savedOccurrence?.id ?? `occurrence-${series.id}-${occursOn}`,
              seriesId: series.id,
              occursOn,
              frequency: series.frequency,
              interval: series.interval,
              startsOn: series.startsOn,
            },
      };
    })
    .filter((entry): entry is {
      block: ScheduleBlock;
      task: TaskItem;
      occurrence: DayPlanOccurrence | undefined;
    } => entry !== null && entry.task !== undefined)
    .sort((left, right) => left.block.startsAt.localeCompare(right.block.startsAt));
  const taskIdsWithDayBlock = new Set(dayBlocks.map(({ task }) => task.id));

  return {
    untimedTasks: activeTasks
      .filter((task) => (
        !taskIdsWithDayBlock.has(task.id)
        && (matchesRecurringPlanDate(
          'task',
          task.id,
          isoDate,
          recurrenceSeries,
          occurrencesBySeriesAndDate,
        ) ?? matchesPlanDate(task, isoDate))
      ))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    untimedReminders: reminders
      .filter((reminder) => (
        reminder.completedAt === null
        && (matchesRecurringPlanDate(
          'reminder',
          reminder.id,
          isoDate,
          recurrenceSeries,
          occurrencesBySeriesAndDate,
        ) ?? matchesPlanDate(reminder, isoDate))
      ))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    blocks: dayBlocks.map(({ block, task, occurrence }) => ({
      id: block.id,
      taskItemId: task.id,
      title: task.title,
      description: task.description,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      sourceBlock: scheduleBlocks.find((sourceBlock) => sourceBlock.id === block.id) ?? block,
      task,
      occurrence,
    })),
    loadPercent,
    tone: getPlanLoadTone(loadPercent),
  };
}
