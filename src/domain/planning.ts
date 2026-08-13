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

interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedDateTimeParts(instant: Date, timeZoneId: string): ZonedDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZoneId,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const readPart = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value === undefined) {
      throw new Error('Unable to read local block time');
    }
    return Number(value);
  };

  return {
    year: readPart('year'),
    month: readPart('month'),
    day: readPart('day'),
    hour: readPart('hour'),
    minute: readPart('minute'),
    second: readPart('second'),
  };
}

function toIsoDateFromParts(parts: Pick<ZonedDateTimeParts, 'year' | 'month' | 'day'>): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function getTimeZoneOffsetMilliseconds(instant: Date, timeZoneId: string): number {
  const parts = getZonedDateTimeParts(instant, timeZoneId);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    - instant.getTime();
}

function formatTimeZoneOffset(offsetMilliseconds: number): string {
  const sign = offsetMilliseconds >= 0 ? '+' : '-';
  const absoluteMinutes = Math.round(Math.abs(offsetMilliseconds) / 60_000);
  return `${sign}${String(Math.floor(absoluteMinutes / 60)).padStart(2, '0')}:${String(absoluteMinutes % 60).padStart(2, '0')}`;
}

function toZonedDateTime(
  isoDate: string,
  time: Pick<ZonedDateTimeParts, 'hour' | 'minute' | 'second'>,
  timeZoneId: string,
): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const asUtc = Date.UTC(year, month - 1, day, time.hour, time.minute, time.second);
  let instant = new Date(asUtc - getTimeZoneOffsetMilliseconds(new Date(asUtc), timeZoneId));
  instant = new Date(asUtc - getTimeZoneOffsetMilliseconds(instant, timeZoneId));
  const offset = getTimeZoneOffsetMilliseconds(instant, timeZoneId);

  return `${isoDate}T${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}:${String(time.second).padStart(2, '0')}${formatTimeZoneOffset(offset)}`;
}

export function getScheduleBlockDayBounds(block: ScheduleBlock, isoDate: string): {
  dayEnd: number;
  dayEndDateTime: string;
  dayStart: number;
  dayStartDateTime: string;
} {
  if (block.timeZoneId !== null && block.timeZoneId !== undefined) {
    const dayStartDateTime = toZonedDateTime(isoDate, { hour: 0, minute: 0, second: 0 }, block.timeZoneId);
    const dayEndDateTime = toZonedDateTime(addDays(isoDate, 1), { hour: 0, minute: 0, second: 0 }, block.timeZoneId);
    return {
      dayStart: new Date(dayStartDateTime).getTime(),
      dayEnd: new Date(dayEndDateTime).getTime(),
      dayStartDateTime,
      dayEndDateTime,
    };
  }

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
  const { dayEnd, dayStart } = getScheduleBlockDayBounds(block, isoDate);
  const startsAt = new Date(block.startsAt).getTime();
  const endsAt = new Date(block.endsAt).getTime();
  return Math.max(0, Math.min(endsAt, dayEnd) - Math.max(startsAt, dayStart)) / 60_000;
}

export function doesScheduleBlockOverlapDate(block: ScheduleBlock, isoDate: string): boolean {
  const { dayEnd, dayStart } = getScheduleBlockDayBounds(block, isoDate);
  const startsAt = new Date(block.startsAt).getTime();
  const endsAt = new Date(block.endsAt).getTime();
  return startsAt < dayEnd && dayStart < endsAt;
}

export function clipScheduleBlockToDate(block: ScheduleBlock, isoDate: string): ScheduleBlock | null {
  const { dayEnd, dayEndDateTime, dayStart, dayStartDateTime } = getScheduleBlockDayBounds(block, isoDate);
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
    timeZoneId: null,
    createdAt,
  };
}

/**
 * Projects a master block from one recurrence date to another. Zoned blocks
 * preserve their wall-clock time; legacy records retain their ISO offset.
 */
export function shiftScheduleBlockToDate(
  block: ScheduleBlock,
  targetOccursOn: string,
  sourceOccursOn?: string,
): ScheduleBlock {
  const source = sourceOccursOn
    ?? (block.timeZoneId === null || block.timeZoneId === undefined
      ? block.startsAt.slice(0, 10)
      : toIsoDateFromParts(getZonedDateTimeParts(new Date(block.startsAt), block.timeZoneId)));
  const shiftDays = Math.round(
    (parseIsoDate(targetOccursOn).getTime() - parseIsoDate(source).getTime()) / 86_400_000,
  );
  const shiftLegacyDateTime = (dateTime: string): string => {
    const localDate = dateTime.slice(0, 10);
    return `${addDays(localDate, shiftDays)}${dateTime.slice(10)}`;
  };

  if (block.timeZoneId === null || block.timeZoneId === undefined) {
    return {
      ...block,
      startsAt: shiftLegacyDateTime(block.startsAt),
      endsAt: shiftLegacyDateTime(block.endsAt),
    };
  }

  const startsAtParts = getZonedDateTimeParts(new Date(block.startsAt), block.timeZoneId);
  const endsAtParts = getZonedDateTimeParts(new Date(block.endsAt), block.timeZoneId);
  return {
    ...block,
    startsAt: toZonedDateTime(
      addDays(toIsoDateFromParts(startsAtParts), shiftDays),
      startsAtParts,
      block.timeZoneId,
    ),
    endsAt: toZonedDateTime(
      addDays(toIsoDateFromParts(endsAtParts), shiftDays),
      endsAtParts,
      block.timeZoneId,
    ),
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
  estimatedMinutes = 0,
): number {
  parseIsoDate(isoDate);
  const workdayMinutes =
    minutesSinceMidnight(settings.workdayEndsAt) - minutesSinceMidnight(settings.workdayStartsAt);

  if (workdayMinutes <= 0) {
    throw new Error('Конец рабочего диапазона должен быть позже начала');
  }

  const plannedMinutes = blocks
    .reduce((total, block) => total + getBlockMinutesOnLocalDate(block, isoDate), estimatedMinutes);

  return (plannedMinutes / workdayMinutes) * 100;
}

function getIsoDayNumber(isoDate: string): number {
  const date = parseIsoDate(isoDate);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/**
 * Returns the share of an untimed estimate assigned to one local plan date.
 * Period remainders are allocated from the first date so the original total
 * is preserved exactly.
 */
export function getEstimatedDurationMinutesOnDate(
  estimatedDurationMinutes: number | null,
  range: PlanningDateRange,
  isoDate: string,
): number {
  getIsoDayNumber(isoDate);
  assertPlanningDateRange(range);
  if (estimatedDurationMinutes === null) {
    return 0;
  }
  if (range.singleDate === isoDate) {
    return estimatedDurationMinutes;
  }
  if (range.periodStartOn === null || range.periodEndOn === null) {
    return 0;
  }

  const startDay = getIsoDayNumber(range.periodStartOn);
  const endDay = getIsoDayNumber(range.periodEndOn);
  const selectedDay = getIsoDayNumber(isoDate);
  if (selectedDay < startDay || selectedDay > endDay) {
    return 0;
  }

  const dayCount = endDay - startDay + 1;
  const quotient = Math.floor(estimatedDurationMinutes / dayCount);
  const remainder = estimatedDurationMinutes % dayCount;
  return quotient + (selectedDay - startDay < remainder ? 1 : 0);
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
