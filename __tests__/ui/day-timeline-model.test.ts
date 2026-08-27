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

  test('lays out two thousand short blocks within the interaction budget', () => {
    const blocks = Array.from({ length: 2_000 }, (_, index) => {
      const minute = index % (24 * 12);
      const startHour = Math.floor(minute / 12);
      const startMinute = (minute % 12) * 5;
      const endMinuteOfDay = (minute + 1) * 5;
      const endHour = Math.floor((endMinuteOfDay % (24 * 60)) / 60);
      const endMinute = endMinuteOfDay % 60;
      const endDate = endMinuteOfDay === 24 * 60 ? '2026-08-23' : '2026-08-22';
      const formatTime = (hour: number, value: number) => `${String(hour).padStart(2, '0')}:${String(value).padStart(2, '0')}`;
      return block(`dense-${index}`, `2026-08-22T${formatTime(startHour, startMinute)}:00+03:00`, `${endDate}T${formatTime(endHour, endMinute)}:00+03:00`);
    });
    const startedAt = performance.now();

    const layouts = getDayTimelineBlockLayouts(blocks, '2026-08-22', 'Europe/Moscow');

    expect(layouts).toHaveLength(2_000);
    expect(Math.max(...layouts.map((layout) => layout.columnCount))).toBe(7);
    expect(performance.now() - startedAt).toBeLessThan(1_000);
  });
});
