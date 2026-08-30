import type { AppSettings, EntityId, ScheduleBlock } from './entities';

export type PlanLoadTone = 'low' | 'medium' | 'high';
export interface RecurrenceRule { frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'intervalDays'; interval: number; startsOn: string; weekdays?: readonly number[]; }
export interface PlanningDateRange { singleDate: string | null; periodStartOn: string | null; periodEndOn: string | null; }

function dateOf(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Дата планирования должна иметь формат ГГГГ-ММ-ДД');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Дата планирования некорректна');
  return date;
}
function iso(date: Date): string { return date.toISOString().slice(0, 10); }
function addDays(value: string, amount: number): string { const date = dateOf(value); date.setUTCDate(date.getUTCDate() + amount); return iso(date); }
function addMonths(value: string, amount: number): string { const source = dateOf(value); const month = source.getUTCMonth() + amount; const year = source.getUTCFullYear() + Math.floor(month / 12); const targetMonth = (month % 12 + 12) % 12; return iso(new Date(Date.UTC(year, targetMonth, Math.min(source.getUTCDate(), new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate())))); }
function weekday(value: string): number { return dateOf(value).getUTCDay(); }
function minutes(value: string): number { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Время должно иметь формат ЧЧ:ММ'); const [hours, mins] = value.split(':').map(Number); return hours * 60 + mins; }
const timeZoneFormatters = new Map<string, Intl.DateTimeFormat>();
function zoneParts(instant: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const formatter = timeZoneFormatters.get(timeZone) ?? new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  timeZoneFormatters.set(timeZone, formatter);
  const parts = formatter.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}
export function getDateTimeInTimeZone(instant: string, timeZone: string): { date: string; time: string } {
  const parts = zoneParts(new Date(instant), timeZone);
  return {
    date: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    time: `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`,
  };
}
export function getDateInTimeZone(instant: string, timeZone: string): string {
  return getDateTimeInTimeZone(instant, timeZone).date;
}
export function getTimeInTimeZone(instant: string, timeZone: string): string {
  return getDateTimeInTimeZone(instant, timeZone).time;
}
function zoned(value: string, timeZone: string): Date {
  const [year, month, day] = value.split('-').map(Number); const guessed = Date.UTC(year, month - 1, day);
  let instant = guessed;
  for (let step = 0; step < 2; step += 1) { const parts = zoneParts(new Date(instant), timeZone); instant = guessed - (Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant); }
  return new Date(instant);
}
function zonedDateTime(value: string, time: { hour: number; minute: number; second: number }, timeZone: string): string {
  const [year, month, day] = value.split('-').map(Number); const wanted = Date.UTC(year, month - 1, day, time.hour, time.minute, time.second); let instant = wanted;
  for (let step = 0; step < 2; step += 1) { const parts = zoneParts(new Date(instant), timeZone); instant = wanted - (Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant); }
  const offsetMinutes = Math.round((Date.UTC(zoneParts(new Date(instant), timeZone).year, zoneParts(new Date(instant), timeZone).month - 1, zoneParts(new Date(instant), timeZone).day, zoneParts(new Date(instant), timeZone).hour, zoneParts(new Date(instant), timeZone).minute, zoneParts(new Date(instant), timeZone).second) - instant) / 60_000); const sign = offsetMinutes >= 0 ? '+' : '-';
  return `${value}T${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}:${String(time.second).padStart(2, '0')}${sign}${String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0')}:${String(Math.abs(offsetMinutes) % 60).padStart(2, '0')}`;
}
export function getInstantInTimeZone(date: string, time: string, timeZone: string): string {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('Время должно иметь формат ЧЧ:ММ');
  }
  return new Date(zonedDateTime(date, { hour, minute, second: 0 }, timeZone)).toISOString();
}
function bounds(block: ScheduleBlock, day: string): [number, number] { return [zoned(day, block.timeZoneId).getTime(), zoned(addDays(day, 1), block.timeZoneId).getTime()]; }

export function assertPlanningDateRange(value: PlanningDateRange): void { if (value.singleDate !== null) dateOf(value.singleDate); if (value.periodStartOn === null && value.periodEndOn === null) return; if (value.periodStartOn === null || value.periodEndOn === null || dateOf(value.periodStartOn) > dateOf(value.periodEndOn)) throw new Error('Начало и конец периода нужно указать вместе и в правильном порядке'); }
export function assertRecurrenceRule(rule: RecurrenceRule): void { dateOf(rule.startsOn); if (!Number.isInteger(rule.interval) || rule.interval <= 0) throw new Error('Интервал повторения должен быть положительным целым числом'); if (rule.weekdays !== undefined && (rule.weekdays.length === 0 || rule.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) throw new Error('Дни недели должны быть числами от 0 до 6'); }
export function getRecurrenceDates(rule: RecurrenceRule, from: string, to: string): string[] {
  assertRecurrenceRule(rule); if (dateOf(from) > dateOf(to)) throw new Error('Начало диапазона позже конца');
  if (rule.frequency === 'weekly' && rule.weekdays !== undefined) {
    const result: string[] = []; const days = new Set(rule.weekdays); let value = rule.startsOn;
    while (dateOf(value) <= dateOf(to)) { const weeks = Math.floor((dateOf(value).getTime() - dateOf(rule.startsOn).getTime()) / 604_800_000); if (weeks % rule.interval === 0 && days.has(weekday(value)) && dateOf(value) >= dateOf(from)) result.push(value); value = addDays(value, 1); }
    return result;
  }
  const result: string[] = []; for (let index = 0; ; index += 1) { const value = rule.frequency === 'daily' ? addDays(rule.startsOn, index) : rule.frequency === 'intervalDays' ? addDays(rule.startsOn, index * rule.interval) : rule.frequency === 'weekly' ? addDays(rule.startsOn, index * rule.interval * 7) : rule.frequency === 'monthly' ? addMonths(rule.startsOn, index * rule.interval) : addMonths(rule.startsOn, index * rule.interval * 12); if (dateOf(value) > dateOf(to)) break; if (dateOf(value) >= dateOf(from)) result.push(value); } return result;
}
export function assertRecurrenceOccurrence(rule: RecurrenceRule, occursOn: string): void { if (!getRecurrenceDates(rule, occursOn, occursOn).includes(occursOn)) throw new Error('Экземпляр не принадлежит серии повторения'); }
export function findScheduleConflicts(candidate: ScheduleBlock, existing: readonly ScheduleBlock[]): ScheduleBlock[] { const start = new Date(candidate.startsAt).getTime(); const end = new Date(candidate.endsAt).getTime(); return existing.filter((block) => block.id !== candidate.id && start < new Date(block.endsAt).getTime() && new Date(block.startsAt).getTime() < end); }
export function findFirstAvailablePlanTime(input: { blocks: readonly ScheduleBlock[]; date: string; durationMinutes: number; now: Date; settings: Pick<AppSettings, 'timeZoneId' | 'workdayStartsAt' | 'workdayEndsAt'> }): string | null {
  const startOfWorkday = minutes(input.settings.workdayStartsAt);
  const endOfWorkday = minutes(input.settings.workdayEndsAt);
  const isToday = getDateInTimeZone(input.now.toISOString(), input.settings.timeZoneId) === input.date;
  const currentTime = isToday ? minutes(getTimeInTimeZone(input.now.toISOString(), input.settings.timeZoneId)) : startOfWorkday;
  const firstCandidate = Math.max(startOfWorkday, Math.ceil((currentTime + 1) / 5) * 5);
  for (let candidate = firstCandidate; candidate + input.durationMinutes <= endOfWorkday; candidate += 5) {
    const startsAt = getInstantInTimeZone(input.date, `${String(Math.floor(candidate / 60)).padStart(2, '0')}:${String(candidate % 60).padStart(2, '0')}`, input.settings.timeZoneId);
    const endsAt = new Date(new Date(startsAt).getTime() + input.durationMinutes * 60_000).toISOString();
    if (findScheduleConflicts({ id: 'new-plan-block', taskItemId: 'new-plan-task', occurrenceId: null, timeZoneId: input.settings.timeZoneId, startsAt, endsAt, createdAt: startsAt, updatedAt: startsAt, deletedAt: null }, input.blocks).length === 0) {
      return getTimeInTimeZone(startsAt, input.settings.timeZoneId);
    }
  }
  return null;
}
export function getDayLoadPercent(settings: AppSettings, blocks: readonly ScheduleBlock[], day: string, estimatedMinutes = 0): number { const capacity = minutes(settings.workdayEndsAt) - minutes(settings.workdayStartsAt); if (capacity <= 0) throw new Error('Конец рабочего диапазона должен быть позже начала'); const total = blocks.reduce((sum, block) => { const [start, end] = bounds(block, day); return sum + Math.max(0, Math.min(new Date(block.endsAt).getTime(), end) - Math.max(new Date(block.startsAt).getTime(), start)) / 60_000; }, estimatedMinutes); return total / capacity * 100; }
export function getPlanLoadTone(value: number): PlanLoadTone { return value <= 50 ? 'low' : value <= 70 ? 'medium' : 'high'; }
export function createDefaultScheduleBlock(input: { id: EntityId; taskItemId: EntityId; now: Date; createdAt: string; }): ScheduleBlock { const start = new Date(input.now); start.setUTCSeconds(0, 0); start.setUTCMinutes(Math.ceil(start.getUTCMinutes() / 5) * 5); if (start <= input.now) start.setUTCMinutes(start.getUTCMinutes() + 5); return { id: input.id, taskItemId: input.taskItemId, occurrenceId: null, timeZoneId: 'UTC', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3_600_000).toISOString(), createdAt: input.createdAt, updatedAt: input.createdAt, deletedAt: null }; }
export function doesScheduleBlockOverlapDate(block: ScheduleBlock, day: string): boolean { const [start, end] = bounds(block, day); return new Date(block.startsAt).getTime() < end && start < new Date(block.endsAt).getTime(); }
export function shiftScheduleBlockToDate(block: ScheduleBlock, target: string, source = block.startsAt.slice(0, 10)): ScheduleBlock { const start = zoneParts(new Date(block.startsAt), block.timeZoneId); const end = zoneParts(new Date(block.endsAt), block.timeZoneId); const shift = Math.round((dateOf(target).getTime() - dateOf(source).getTime()) / 86_400_000); const endDate = addDays(`${end.year}-${String(end.month).padStart(2, '0')}-${String(end.day).padStart(2, '0')}`, shift); return { ...block, startsAt: zonedDateTime(target, start, block.timeZoneId), endsAt: zonedDateTime(endDate, end, block.timeZoneId) }; }
