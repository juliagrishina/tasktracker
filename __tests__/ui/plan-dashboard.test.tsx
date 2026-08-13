import { fireEvent, render } from '@testing-library/react-native';

import { DayDashboard } from '../../src/ui/plan/day-dashboard';
import { designTokens } from '../../src/ui/design/tokens';
import { MonthLoadGrid } from '../../src/ui/plan/month-load-grid';
import { ProgressRing } from '../../src/ui/plan/progress-ring';

describe('ProgressRing', () => {
  test('announces the approved completion percentage to assistive technology', async () => {
    const view = await render(<ProgressRing label="35%" value={35} />);

    expect(view.getByLabelText('Выполнено 35%')).toBeOnTheScreen();
  });
});

describe('DayDashboard', () => {
  test('renders the Plan hierarchy with persisted items instead of the development demo list', async () => {
    const view = await render(
      <DayDashboard
        dayPlan={{
          loadPercent: 7.142857142857143,
          tone: 'low',
          blocks: [{
            id: 'team-call',
            taskItemId: 'task-call',
            title: 'Созвон с командой',
            description: null,
            startsAt: '2026-08-05T10:00:00+03:00',
            endsAt: '2026-08-05T11:00:00+03:00',
          }],
          untimedTasks: [{
            id: 'untimed-task',
            kind: 'task',
            projectId: null,
            parentTaskId: null,
            title: 'Проверить макеты',
            description: null,
            scheduledOn: '2026-08-05',
            periodStartOn: null,
            periodEndOn: null,
            estimatedDurationMinutes: null,
            completedAt: null,
            createdAt: '2026-08-01T08:00:00.000Z',
          }],
          untimedReminders: [],
        }}
        selectedDate="2026-08-05"
      />,
    );

    expect(view.getByText('План')).toBeOnTheScreen();
    expect(view.getByText('План в норме')).toBeOnTheScreen();
    expect(view.getByText('Без времени')).toBeOnTheScreen();
    expect(view.getByText('Расписание')).toBeOnTheScreen();
    expect(view.getAllByText('Созвон с командой')).toHaveLength(2);
    expect(view.getByText('Проверить макеты')).toBeOnTheScreen();
    expect(view.queryByText('Планёрка команды')).toBeNull();
  });

  test('makes an untimed recurring reminder available for editing with its occurrence context', async () => {
    const onEditItem = jest.fn();
    const reminder = {
      id: 'recurring-reminder',
      title: 'Принять лекарство',
      remindsOn: '2026-08-15',
      periodStartOn: null,
      periodEndOn: null,
      repeatRule: { frequency: 'daily' as const, interval: 1 },
      estimatedDurationMinutes: 5,
      completedAt: null,
      createdAt: '2026-08-15T08:00:00.000Z',
      occurrence: {
        id: 'occurrence-reminder-series-2026-08-15',
        seriesId: 'reminder-series',
        occursOn: '2026-08-15',
        frequency: 'daily' as const,
        interval: 1,
        startsOn: '2026-08-15',
      },
    };
    const view = await render(
      <DayDashboard
        dayPlan={{
          loadPercent: 0.5952380952380952,
          tone: 'low',
          blocks: [],
          untimedTasks: [],
          untimedReminders: [reminder],
        }}
        onEditItem={onEditItem}
        selectedDate="2026-08-15"
      />,
    );

    const editAction = view.getByLabelText('Редактировать Принять лекарство');
    expect(editAction).toBeOnTheScreen();
    await fireEvent.press(editAction);

    expect(onEditItem).toHaveBeenCalledWith(reminder, reminder.occurrence, undefined);
  });
});

describe('MonthLoadGrid', () => {
  test('renders a long fractional load compactly inside a mobile day cell', async () => {
    const view = await render(
      <MonthLoadGrid
        onSelectDate={jest.fn()}
        selectedDate="2026-08-13"
        weeks={[[{
          isoDate: '2026-08-13',
          dayOfMonth: 13,
          weekdayLabel: 'Четверг',
          loadPercent: 17.857142857142858,
          tone: 'low',
        }]]}
      />,
    );

    expect(view.getByText('17.9%')).toBeOnTheScreen();
  });

  test('shows a token-based focus outline for a keyboard-focused day cell', async () => {
    const view = await render(
      <MonthLoadGrid
        onSelectDate={jest.fn()}
        selectedDate="2026-08-13"
        weeks={[[{
          isoDate: '2026-08-13',
          dayOfMonth: 13,
          weekdayLabel: 'Четверг',
          loadPercent: 0,
          tone: 'low',
        }]]}
      />,
    );
    const dayCell = view.getByLabelText('13 августа: загрузка 0%');

    await fireEvent(dayCell, 'focus');

    expect(dayCell).toHaveStyle({
      outlineColor: designTokens.color.primary,
      outlineStyle: 'solid',
      outlineWidth: 3,
    });
  });
});
