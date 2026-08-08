export type PlanViewMode = 'day' | 'week' | 'month';
export type PlanLoadTone = 'low' | 'medium' | 'high';

export interface PlanLoadDay {
  isoDate: string;
  dayOfMonth: number;
  weekdayLabel: string;
  loadPercent: number;
  tone: PlanLoadTone;
}

export type PlanMonthLoadWeeks = Array<Array<PlanLoadDay | null>>;

const weekdayLabels = [
  'Воскресенье',
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
] as const;

const fallbackLoadPercentages = [35, 63, 104, 48, 72, 16, 52, 44, 68, 30, 82, 57, 25, 90, 41, 66, 53, 18, 75, 38, 61, 29, 87, 46, 70, 34, 95, 55, 22, 79, 43] as const;

const demoLoadByIsoDate: Readonly<Record<string, number>> = {
  '2026-08-03': 35,
  '2026-08-04': 63,
  '2026-08-05': 104,
  '2026-08-06': 48,
  '2026-08-07': 72,
  '2026-08-08': 16,
  '2026-08-09': 52,
};

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

function getLoadPercent(isoDate: string): number {
  const date = parseLocalDate(isoDate);
  return demoLoadByIsoDate[isoDate] ?? fallbackLoadPercentages[date.getDate() - 1];
}

function toPlanLoadDay(isoDate: string): PlanLoadDay {
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

export function getWeekLoadDays(selectedDate: string): PlanLoadDay[] {
  const weekStart = startOfWeek(selectedDate);
  return Array.from({ length: 7 }, (_, index) => toPlanLoadDay(addDays(weekStart, index)));
}

export function getMonthLoadDays(selectedDate: string): PlanMonthLoadWeeks {
  const selected = parseLocalDate(selectedDate);
  const year = selected.getFullYear();
  const month = selected.getMonth();
  const firstDay = new Date(year, month, 1);
  const leadingBlankCells = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<PlanLoadDay | null> = Array.from({ length: leadingBlankCells }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toPlanLoadDay(toIsoDate(new Date(year, month, day))));
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
