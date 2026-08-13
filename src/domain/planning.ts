import type { AppSettings, EntityId, ScheduleBlock } from './entities';

export type PlanLoadTone = 'low' | 'medium' | 'high';

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  startsOn: string;
}

export interface PlanningDateRange {
  singleDate: string | null;
  periodEndOn: string | null;
  periodStartOn: string | null;
}

interface CreateDefaultScheduleBlockInput {
  id: EntityId;
  taskItemId: EntityId;
  now: Date;
  createdAt: string;
}

function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error('Дата планирования должна иметь формат ГГГГ-ММ-ДД');
  }

  return parsed;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function addMonths(isoDate: string, monthsToAdd: number): string {
  const source = parseIsoDate(isoDate);
  const targetMonthIndex = source.getMonth() + monthsToAdd;
  const targetYear = source.getFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastTargetDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return toIsoDate(new Date(targetYear, targetMonth, Math.min(source.getDate(), lastTargetDay)));
}

function minutesSinceMidnight(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error('Время рабочего диапазона должно иметь формат ЧЧ:ММ');
  }

  return hours * 60 + minutes;
}

function getOffsetSuffix(dateTime: string): string {
  const suffix = /(Z|[+-]\d{2}:\d{2})$/.exec(dateTime)?.[1];
  if (suffix === undefined) {
    throw new Error('Schedule block must include a timezone offset');
  }

  return suffix;
}

function getScheduleBlockDayBoundaries(block: ScheduleBlock, isoDate: string): {
  dayEnd: number;
  dayEndDateTime: string;
  dayStart: number;
  dayStartDateTime: string;
} {
  const offset = getOffsetSuffix(block.startsAt);
  const dayStartDateTime = `${isoDate}T00:00:00${offset}`;
  const dayEndDateTime = `${addDays(isoDate, 1)}T00:00:00${offset}`;
  return {
    dayStart: new Date(dayStartDateTime).getTime(),
    dayEnd: new Date(dayEndDateTime).getTime(),
    dayStartDateTime,
    dayEndDateTime,
  };
}

function getBlockMinutesOnLocalDate(block: ScheduleBlock, isoDate: string): number {
  const { dayEnd, dayStart } = getScheduleBlockDayBoundaries(block, isoDate);
  const startsAt = new Date(block.startsAt).getTime();
  const endsAt = new Date(block.endsAt).getTime();
  return Math.max(0, Math.min(endsAt, dayEnd) - Math.max(startsAt, dayStart)) / 60_000;
}

export function doesScheduleBlockOverlapDate(block: ScheduleBlock, isoDate: string): boolean {
  const { dayEnd, dayStart } = getScheduleBlockDayBoundaries(block, isoDate);
  const startsAt = new Date(block.startsAt).getTime();
  const endsAt = new Date(block.endsAt).getTime();
  return startsAt < dayEnd && dayStart < endsAt;
}

export function clipScheduleBlockToDate(block: ScheduleBlock, isoDate: string): ScheduleBlock | null {
  const { dayEnd, dayEndDateTime, dayStart, dayStartDateTime } = getScheduleBlockDayBoundaries(block, isoDate);
  const startsAt = new Date(block.startsAt).getTime();
  const endsAt = new Date(block.endsAt).getTime();
  if (startsAt >= dayEnd || endsAt <= dayStart) {
    return null;
  }

  return {
    ...block,
    startsAt: startsAt < dayStart ? dayStartDateTime : block.startsAt,
    endsAt: endsAt > dayEnd ? dayEndDateTime : block.endsAt,
  };
}

export function createDefaultScheduleBlock({
  id,
  taskItemId,
  now,
  createdAt,
}: CreateDefaultScheduleBlockInput): ScheduleBlock {
  const startsAt = new Date(now.getTime());
  startsAt.setUTCSeconds(0, 0);
  startsAt.setUTCMinutes(Math.ceil(startsAt.getUTCMinutes() / 5) * 5);

  if (startsAt.getTime() <= now.getTime()) {
    startsAt.setUTCMinutes(startsAt.getUTCMinutes() + 5);
  }

  const endsAt = new Date(startsAt.getTime() + 60 * 60_000);

  return {
    id,
    taskItemId,
    occurrenceId: null,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    createdAt,
  };
}

export function findScheduleConflicts(
  candidate: ScheduleBlock,
  existingBlocks: readonly ScheduleBlock[],
): ScheduleBlock[] {
  const candidateStartsAt = new Date(candidate.startsAt).getTime();
  const candidateEndsAt = new Date(candidate.endsAt).getTime();

  return existingBlocks.filter(
    (existing) => {
      const existingStartsAt = new Date(existing.startsAt).getTime();
      const existingEndsAt = new Date(existing.endsAt).getTime();

      return (
        existing.id !== candidate.id
        && candidateStartsAt < existingEndsAt
        && existingStartsAt < candidateEndsAt
      );
    },
  );
}

export function getPlanLoadTone(loadPercent: number): PlanLoadTone {
  if (loadPercent <= 50) {
    return 'low';
  }

  if (loadPercent <= 70) {
    return 'medium';
  }

  return 'high';
}

export function assertPlanningDateRange({
  singleDate,
  periodEndOn,
  periodStartOn,
}: PlanningDateRange): void {
  if (singleDate !== null) {
    parseIsoDate(singleDate);
  }
  if (periodStartOn === null && periodEndOn === null) {
    return;
  }
  if (periodStartOn === null || periodEndOn === null) {
    throw new Error('Начало и конец периода нужно указать вместе');
  }

  const start = parseIsoDate(periodStartOn);
  const end = parseIsoDate(periodEndOn);
  if (start.getTime() > end.getTime()) {
    throw new Error('Начало периода не может быть позже конца');
  }
}

export function assertRecurrenceRule(rule: RecurrenceRule): void {
  parseIsoDate(rule.startsOn);
  if (!Number.isInteger(rule.interval) || rule.interval <= 0) {
    throw new Error('Интервал повторения должен быть положительным целым числом');
  }
}

export function assertRecurrenceOccurrence(
  rule: RecurrenceRule,
  occursOn: string,
): void {
  assertRecurrenceRule(rule);
  const occurrence = parseIsoDate(occursOn);
  if (occurrence.getTime() < parseIsoDate(rule.startsOn).getTime()) {
    throw new Error('Экземпляр не может предшествовать началу серии');
  }
  if (!getRecurrenceDates(rule, occursOn, occursOn).includes(occursOn)) {
    throw new Error('Exception date is not generated by this recurrence series');
  }
}

export function getDayLoadPercent(
  settings: AppSettings,
  blocks: readonly ScheduleBlock[],
  isoDate: string,
): number {
  parseIsoDate(isoDate);
  const workdayMinutes =
    minutesSinceMidnight(settings.workdayEndsAt) - minutesSinceMidnight(settings.workdayStartsAt);

  if (workdayMinutes <= 0) {
    throw new Error('Конец рабочего диапазона должен быть позже начала');
  }

  const plannedMinutes = blocks
    .reduce((total, block) => total + getBlockMinutesOnLocalDate(block, isoDate), 0);

  return (plannedMinutes / workdayMinutes) * 100;
}

export function getRecurrenceDates(
  rule: RecurrenceRule,
  rangeStartOn: string,
  rangeEndOn: string,
): string[] {
  const startsOn = parseIsoDate(rule.startsOn);
  const rangeStart = parseIsoDate(rangeStartOn);
  const rangeEnd = parseIsoDate(rangeEndOn);

  if (!Number.isInteger(rule.interval) || rule.interval <= 0) {
    throw new Error('Интервал повторения должен быть положительным целым числом');
  }

  if (rangeStart.getTime() > rangeEnd.getTime()) {
    throw new Error('Начало диапазона не может быть позже конца');
  }

  const dates: string[] = [];
  for (let occurrenceIndex = 0; ; occurrenceIndex += 1) {
    const isoDate =
      rule.frequency === 'daily'
        ? addDays(rule.startsOn, occurrenceIndex * rule.interval)
        : rule.frequency === 'weekly'
          ? addDays(rule.startsOn, occurrenceIndex * rule.interval * 7)
          : addMonths(rule.startsOn, occurrenceIndex * rule.interval);
    const occurrence = parseIsoDate(isoDate);

    if (occurrence.getTime() > rangeEnd.getTime()) {
      break;
    }

    if (occurrence.getTime() >= startsOn.getTime() && occurrence.getTime() >= rangeStart.getTime()) {
      dates.push(isoDate);
    }
  }

  return dates;
}
