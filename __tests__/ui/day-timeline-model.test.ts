import type { ScheduleBlock } from '../../src/domain/entities';
import { getDayTimelineBlockLayouts } from '../../src/ui/plan/day-timeline-model';

function block(id: string, startsAt: string, endsAt: string): ScheduleBlock {
  return {
    id,
    taskItemId: `task-${id}`,
    occurrenceId: null,
    timeZoneId: 'Europe/Moscow',
    startsAt,
    endsAt,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    deletedAt: null,
  };
}

describe('day timeline layout', () => {
  test('places overlapping blocks in separate columns without widening adjacent blocks', () => {
    const layouts = getDayTimelineBlockLayouts([
      block('first', '2026-08-22T09:00:00+03:00', '2026-08-22T10:00:00+03:00'),
      block('second', '2026-08-22T09:30:00+03:00', '2026-08-22T10:30:00+03:00'),
      block('third', '2026-08-22T10:00:00+03:00', '2026-08-22T11:00:00+03:00'),
    ], '2026-08-22', 'Europe/Moscow');

    expect(layouts).toEqual([
      expect.objectContaining({ blockId: 'first', column: 0, columnCount: 2, startMinute: 540, durationMinutes: 60 }),
      expect.objectContaining({ blockId: 'second', column: 1, columnCount: 2, startMinute: 570, durationMinutes: 60 }),
      expect.objectContaining({ blockId: 'third', column: 0, columnCount: 2, startMinute: 600, durationMinutes: 60 }),
    ]);
  });
});
