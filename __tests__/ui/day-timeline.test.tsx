import { render } from '@testing-library/react-native';

import type { ScheduleBlock } from '../../src/domain/entities';
import { DayTimeline } from '../../src/ui/plan/day-timeline';

function block(id: string, taskItemId: string, startsAt: string, endsAt: string): ScheduleBlock {
  return {
    id,
    taskItemId,
    occurrenceId: null,
    timeZoneId: 'Europe/Moscow',
    startsAt,
    endsAt,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    deletedAt: null,
  };
}

describe('DayTimeline', () => {
  test('renders a scrollable full-day grid with a current-time line and overlapping blocks', async () => {
    const view = await render(
      <DayTimeline
        blocks={[
          block('first', 'task-first', '2026-08-22T09:00:00+03:00', '2026-08-22T10:00:00+03:00'),
          block('second', 'task-second', '2026-08-22T09:30:00+03:00', '2026-08-22T10:30:00+03:00'),
        ]}
        now={new Date('2026-08-22T09:45:00+03:00')}
        selectedDate="2026-08-22"
        timeZoneId="Europe/Moscow"
        titleByTaskId={new Map([['task-first', 'Первый блок'], ['task-second', 'Второй блок']])}
      />,
    );

    expect(view.getByLabelText('Суточная шкала: 24 часа')).toBeOnTheScreen();
    expect(view.getByText('00:00')).toBeOnTheScreen();
    expect(view.getByText('23:00')).toBeOnTheScreen();
    expect(view.getByLabelText('Текущее время 09:45')).toBeOnTheScreen();
    expect(view.getByLabelText('Первый блок, 09:00–10:00, колонка 1 из 2')).toBeOnTheScreen();
    expect(view.getByLabelText('Второй блок, 09:30–10:30, колонка 2 из 2')).toBeOnTheScreen();
  });
});
