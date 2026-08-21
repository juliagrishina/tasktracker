export type PlanViewMode = 'day' | 'week' | 'month';
export type PlanLoadTone = 'low' | 'medium' | 'high';

export interface PlanLoadDay {
  isoDate: string;
  dayOfMonth: number;
  weekdayLabel: string;
  loadPercent: number;
  tone: PlanLoadTone;
}

export type PlanMonthLoadWeeks = (PlanLoadDay | null)[][];

const weekdayLabels = [
  'Воскресенье',
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
] as const;

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

function startOfWeek(isoDate: string): string {
  const date = parseLocalDate(isoDate);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return toIsoDate(date);
}

function toPlanLoadDay(isoDate: string, getLoadPercent: (isoDate: string) => number): PlanLoadDay {
  const date = parseLocalDate(isoDate);
  const loadPercent = getLoadPercent(isoDate);

  return {
    isoDate,
    dayOfMonth: date.getDate(),
    weekdayLabel: weekdayLabels[date.getDay()],
    loadPercent,
    tone: getPlanLoadTone(loadPercent),
  };
}

export function getPlanLoadTone(loadPercent: number): PlanLoadTone {
  if (loadPercent <= 50) return 'low';
  if (loadPercent <= 70) return 'medium';
  return 'high';
}

export function getWeekLoadDays(selectedDate: string, getLoadPercent: (isoDate: string) => number = () => 0): PlanLoadDay[] {
  const weekStart = startOfWeek(selectedDate);
  return Array.from({ length: 7 }, (_, index) => toPlanLoadDay(addDays(weekStart, index), getLoadPercent));
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
  const days = getWeekLoadDays(selectedDate);
  const first = parseLocalDate(days[0].isoDate);
  const last = parseLocalDate(days[6].isoDate);

  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()}–${last.getDate()} ${monthLabels[last.getMonth()]}`;
  }

  return `${formatPlanDate(days[0].isoDate)} – ${formatPlanDate(days[6].isoDate)}`;
}

export function getMonthLoadDays(selectedDate: string, getLoadPercent: (isoDate: string) => number = () => 0): PlanMonthLoadWeeks {
  const selected = parseLocalDate(selectedDate);
  const year = selected.getFullYear();
  const month = selected.getMonth();
  const firstDay = new Date(year, month, 1);
  const leadingBlankCells = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (PlanLoadDay | null)[] = Array.from({ length: leadingBlankCells }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toPlanLoadDay(toIsoDate(new Date(year, month, day)), getLoadPercent));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
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
