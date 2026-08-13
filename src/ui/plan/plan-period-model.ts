import { getPeriodDates, type PlanLoadDay } from '../../application/plan-load-selector';
import { getPlanLoadTone, type PlanLoadTone } from '../../domain/planning';

export type PlanViewMode = 'day' | 'week' | 'month';
export type { PlanLoadDay, PlanLoadTone };
export { getPlanLoadTone };

export type PlanMonthLoadWeeks = (PlanLoadDay | null)[][];

const monthLabels = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

const monthTitleLabels = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
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

export function formatPlanDate(isoDate: string): string {
  const date = parseLocalDate(isoDate);
  return `${date.getDate()} ${monthLabels[date.getMonth()]}`;
}

export function formatPlanMonth(isoDate: string): string {
  const date = parseLocalDate(isoDate);
  return `${monthTitleLabels[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatPlanWeekRange(selectedDate: string): string {
  const days = getPeriodDates(selectedDate, 'week');
  const first = parseLocalDate(days[0]);
  const last = parseLocalDate(days[6]);

  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()}–${last.getDate()} ${monthLabels[last.getMonth()]}`;
  }

  return `${formatPlanDate(days[0])} – ${formatPlanDate(days[6])}`;
}

export function toMonthLoadWeeks(
  selectedDate: string,
  loadDays: readonly PlanLoadDay[],
): PlanMonthLoadWeeks {
  const selected = parseLocalDate(selectedDate);
  const firstDay = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const leadingBlankCells = (firstDay.getDay() + 6) % 7;
  const cells: (PlanLoadDay | null)[] = Array.from({ length: leadingBlankCells }, () => null);

  cells.push(...loadDays);
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return Array.from(
    { length: cells.length / 7 },
    (_, index) => cells.slice(index * 7, index * 7 + 7),
  );
}

export function shiftPlanAnchor(selectedDate: string, mode: PlanViewMode, amount: number): string {
  if (mode === 'week') {
    return addDays(selectedDate, amount * 7);
  }

  if (mode === 'month') {
    const selected = parseLocalDate(selectedDate);
    const targetMonth = selected.getMonth() + amount;
    const targetYear = selected.getFullYear() + Math.floor(targetMonth / 12);
    const normalizedTargetMonth = ((targetMonth % 12) + 12) % 12;
    const targetDays = new Date(targetYear, normalizedTargetMonth + 1, 0).getDate();
    return toIsoDate(new Date(targetYear, normalizedTargetMonth, Math.min(selected.getDate(), targetDays)));
  }

  return addDays(selectedDate, amount);
}
