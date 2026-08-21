import type { AppSettings, ScheduleBlock } from '../../src/domain/entities';
import {
  assertRecurrenceOccurrence,
  createDefaultScheduleBlock,
  getDateInTimeZone,
  getInstantInTimeZone,
  getTimeInTimeZone,
  findScheduleConflicts,
  getDayLoadPercent,
  getPlanLoadTone,
  getRecurrenceDates,
  shiftScheduleBlockToDate,
} from '../../src/domain/planning';

const settings: AppSettings = {
  timeZoneId: 'Europe/Moscow',
  workdayStartsAt: '09:00',
  workdayEndsAt: '17:00',
  eveningReviewAt: '17:15',
  notificationLeadMinutes: 15,
};

const block: ScheduleBlock = {
  id: 'block-1', taskItemId: 'task-1', occurrenceId: null, timeZoneId: 'Europe/Moscow',
  startsAt: '2026-08-03T09:00:00+03:00', endsAt: '2026-08-03T10:00:00+03:00',
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', deletedAt: null,
};

describe('planning domain', () => {
  test('projects stored instants into the selected planning timezone', () => {
    expect(getDateInTimeZone('2026-08-03T22:30:00.000Z', 'Europe/Moscow')).toBe('2026-08-04');
    expect(getTimeInTimeZone('2026-08-03T07:00:00.000Z', 'Europe/Berlin')).toBe('09:00');
  });

  test('turns a wall-clock form value into an instant in the selected planning timezone', () => {
    expect(getInstantInTimeZone('2026-08-03', '10:00', 'Europe/Moscow')).toBe('2026-08-03T07:00:00.000Z');
  });

  test('uses only exact scheduled blocks for day load and retains >100 percent', () => {
    expect(getDayLoadPercent(settings, [block], '2026-08-03')).toBe(12.5);
    expect(getPlanLoadTone(getDayLoadPercent(settings, [{ ...block, endsAt: '2026-08-04T02:00:00+03:00' }], '2026-08-03'))).toBe('high');
  });

  test('adds estimated minutes for items without an exact time block to day load', () => {
    expect(getDayLoadPercent(settings, [block], '2026-08-03', 120)).toBe(37.5);
  });

  test('projects calendar recurrences and rejects an exception before its series', () => {
    expect(getRecurrenceDates({ frequency: 'weekly', interval: 2, startsOn: '2026-08-03' }, '2026-08-01', '2026-09-01'))
      .toEqual(['2026-08-03', '2026-08-17', '2026-08-31']);
    expect(() => assertRecurrenceOccurrence({ frequency: 'weekly', interval: 1, startsOn: '2026-08-03' }, '2026-08-02')).toThrow();
  });

  test('projects selected weekdays, yearly dates and every N days', () => {
    expect(getRecurrenceDates({ frequency: 'weekly', interval: 1, startsOn: '2026-08-03', weekdays: [1, 3, 5] } as never, '2026-08-03', '2026-08-09'))
      .toEqual(['2026-08-03', '2026-08-05', '2026-08-07']);
    expect(getRecurrenceDates({ frequency: 'yearly', interval: 1, startsOn: '2024-02-29' } as never, '2025-01-01', '2026-12-31'))
      .toEqual(['2025-02-28', '2026-02-28']);
    expect(getRecurrenceDates({ frequency: 'intervalDays', interval: 3, startsOn: '2026-08-01' } as never, '2026-08-01', '2026-08-10'))
      .toEqual(['2026-08-01', '2026-08-04', '2026-08-07', '2026-08-10']);
  });

  test('covers month/year boundaries, leap day and DST local-time preservation', () => {
    expect(getRecurrenceDates({ frequency: 'monthly', interval: 1, startsOn: '2026-01-31' }, '2026-01-01', '2026-03-31'))
      .toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(getRecurrenceDates({ frequency: 'yearly', interval: 1, startsOn: '2024-02-29' }, '2024-01-01', '2028-12-31'))
      .toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
    expect(shiftScheduleBlockToDate({ ...block, timeZoneId: 'Europe/Berlin', startsAt: '2026-03-28T09:00:00+01:00', endsAt: '2026-03-28T10:00:00+01:00' }, '2026-03-29')).toMatchObject({
      startsAt: '2026-03-29T09:00:00+02:00',
      endsAt: '2026-03-29T10:00:00+02:00',
    });
  });

  test('finds overlap but allows adjacent blocks and makes a future five-minute default', () => {
    expect(findScheduleConflicts({ ...block, id: 'candidate', startsAt: '2026-08-03T09:30:00+03:00', endsAt: '2026-08-03T10:30:00+03:00' }, [block])).toHaveLength(1);
    expect(findScheduleConflicts({ ...block, id: 'candidate', startsAt: block.endsAt, endsAt: '2026-08-03T11:00:00+03:00' }, [block])).toHaveLength(0);
    expect(createDefaultScheduleBlock({ id: 'next', taskItemId: 'task-1', createdAt: block.createdAt, now: new Date('2026-08-03T23:59:00.000Z') }).startsAt)
      .toBe('2026-08-04T00:00:00.000Z');
  });
});
