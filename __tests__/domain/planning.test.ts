import type { AppSettings, ScheduleBlock } from '../../src/domain/entities';
import {
  createDefaultScheduleBlock,
  findScheduleConflicts,
  getDayLoadPercent,
  getPlanLoadTone,
  getRecurrenceDates,
} from '../../src/domain/planning';

const settings: AppSettings = {
  workdayStartsAt: '08:00',
  workdayEndsAt: '22:00',
  eveningReviewAt: '20:00',
  notificationLeadMinutes: 10,
};

function block(id: string, startsAt: string, endsAt: string): ScheduleBlock {
  return {
    id,
    taskItemId: 'task-1',
    occurrenceId: null,
    startsAt,
    endsAt,
    createdAt: '2026-08-05T06:00:00.000Z',
  };
}

describe('planning domain rules', () => {
  test('rounds the default block start up to the next five-minute boundary', () => {
    expect(
      createDefaultScheduleBlock({
        id: 'block-default',
        taskItemId: 'task-1',
        now: new Date('2026-08-05T06:01:00.000Z'),
        createdAt: '2026-08-05T06:01:00.000Z',
      }),
    ).toMatchObject({
      startsAt: '2026-08-05T06:05:00.000Z',
      endsAt: '2026-08-05T07:05:00.000Z',
    });
  });

  test('reports all own blocks that overlap a candidate interval', () => {
    const candidate = block('candidate', '2026-08-05T09:00:00.000Z', '2026-08-05T10:00:00.000Z');
    const conflicts = findScheduleConflicts(candidate, [
      block('before', '2026-08-05T08:00:00.000Z', '2026-08-05T09:00:00.000Z'),
      block('inside', '2026-08-05T09:15:00.000Z', '2026-08-05T09:45:00.000Z'),
      block('after', '2026-08-05T09:30:00.000Z', '2026-08-05T10:30:00.000Z'),
    ]);

    expect(conflicts.map(({ id }) => id)).toEqual(['inside', 'after']);
  });

  test('counts overlapping and outside-workday blocks in full', () => {
    const percentage = getDayLoadPercent(settings, [
      block('one', '2026-08-05T09:00:00.000+03:00', '2026-08-05T10:00:00.000+03:00'),
      block('two', '2026-08-05T09:30:00.000+03:00', '2026-08-05T10:30:00.000+03:00'),
      block('three', '2026-08-05T23:00:00.000+03:00', '2026-08-06T00:00:00.000+03:00'),
    ], '2026-08-05');

    expect(percentage).toBeCloseTo(21.428571428571427);
  });

  test.each([
    [50, 'low'],
    [51, 'medium'],
    [70, 'medium'],
    [71, 'high'],
    [140, 'high'],
  ] as const)('maps %i%% load to %s', (percentage, tone) => {
    expect(getPlanLoadTone(percentage)).toBe(tone);
  });

  test('generates monthly occurrences across February of a leap year', () => {
    expect(
      getRecurrenceDates(
        {
          frequency: 'monthly',
          interval: 1,
          startsOn: '2028-01-31',
        },
        '2028-01-01',
        '2028-03-31',
      ),
    ).toEqual(['2028-01-31', '2028-02-29', '2028-03-31']);
  });
});
