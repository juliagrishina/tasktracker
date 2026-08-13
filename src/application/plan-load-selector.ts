import type { AppDataSource } from '../data/contracts';
import type { Reminder, TaskItem } from '../domain/entities';
import { getPlanLoadTone, type PlanLoadTone } from '../domain/planning';

import { getPlanLoad } from './planning-use-cases';

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

export async function getDayPlan(source: AppDataSource, isoDate: string): Promise<DayPlan> {
  const [taskItems, reminders, scheduleBlocks, loadPercent] = await Promise.all([
    source.listTaskItems(),
    source.listReminders(),
    source.listScheduleBlocks(),
    getPlanLoad(source, isoDate),
  ]);
  const activeTasks = taskItems.filter((task) => task.completedAt === null);
  const tasksById = new Map(activeTasks.map((task) => [task.id, task]));
  const dayBlocks = scheduleBlocks
    .filter((block) => block.startsAt.slice(0, 10) === isoDate)
    .map((block) => ({ block, task: tasksById.get(block.taskItemId) }))
    .filter((entry): entry is { block: typeof entry.block; task: TaskItem } => entry.task !== undefined)
    .sort((left, right) => left.block.startsAt.localeCompare(right.block.startsAt));
  const taskIdsWithDayBlock = new Set(dayBlocks.map(({ task }) => task.id));

  return {
    untimedTasks: activeTasks
      .filter((task) => !taskIdsWithDayBlock.has(task.id) && matchesPlanDate(task, isoDate))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    untimedReminders: reminders
      .filter((reminder) => reminder.completedAt === null && matchesPlanDate(reminder, isoDate))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    blocks: dayBlocks.map(({ block, task }) => ({
      id: block.id,
      taskItemId: task.id,
      title: task.title,
      description: task.description,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
    })),
    loadPercent,
    tone: getPlanLoadTone(loadPercent),
  };
}
