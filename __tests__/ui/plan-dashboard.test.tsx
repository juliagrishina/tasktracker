import { render } from '@testing-library/react-native';

import { DayDashboard } from '../../src/ui/plan/day-dashboard';
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
});
