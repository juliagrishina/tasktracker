import type { AppSettings, ScheduleBlock } from '../../src/domain/entities';
import {
  assertRecurrenceOccurrence,
  createDefaultScheduleBlock,
  findScheduleConflicts,
  getDayLoadPercent,
  getPlanLoadTone,
  getRecurrenceDates,
} from '../../src/domain/planning';

const settings: AppSettings = {
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
  test('uses only exact scheduled blocks for day load and retains >100 percent', () => {
    expect(getDayLoadPercent(settings, [block], '2026-08-03')).toBe(12.5);
    expect(getPlanLoadTone(getDayLoadPercent(settings, [{ ...block, endsAt: '2026-08-04T02:00:00+03:00' }], '2026-08-03'))).toBe('high');
  });

  test('projects calendar recurrences and rejects an exception before its series', () => {
    expect(getRecurrenceDates({ frequency: 'weekly', interval: 2, startsOn: '2026-08-03' }, '2026-08-01', '2026-09-01'))
      .toEqual(['2026-08-03', '2026-08-17', '2026-08-31']);
    expect(() => assertRecurrenceOccurrence({ frequency: 'weekly', interval: 1, startsOn: '2026-08-03' }, '2026-08-02')).toThrow();
  });

  test('finds overlap but allows adjacent blocks and makes a future five-minute default', () => {
    expect(findScheduleConflicts({ ...block, id: 'candidate', startsAt: '2026-08-03T09:30:00+03:00', endsAt: '2026-08-03T10:30:00+03:00' }, [block])).toHaveLength(1);
    expect(findScheduleConflicts({ ...block, id: 'candidate', startsAt: block.endsAt, endsAt: '2026-08-03T11:00:00+03:00' }, [block])).toHaveLength(0);
    expect(createDefaultScheduleBlock({ id: 'next', taskItemId: 'task-1', createdAt: block.createdAt, now: new Date('2026-08-03T23:59:00.000Z') }).startsAt)
      .toBe('2026-08-04T00:00:00.000Z');
  });
});
