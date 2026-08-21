import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { DayDashboard } from '../../src/ui/plan/day-dashboard';
import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { ProgressRing } from '../../src/ui/plan/progress-ring';

describe('ProgressRing', () => {
  test('announces the approved completion percentage to assistive technology', async () => {
    const view = await render(<ProgressRing label="35%" value={35} />);

    expect(view.getByLabelText('Выполнено 35%')).toBeOnTheScreen();
  });
});

describe('DayDashboard', () => {
  test('shows a date-only task and lets the user return it to Backlog', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'date-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Задача без времени', description: null, estimatedDurationMinutes: null, scheduledOn: '2026-08-10', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-10" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByText('Задача без времени')).toBeOnTheScreen());
    fireEvent.press(view.getByText('Задача без времени'));
    await waitFor(() => expect(view.getByLabelText('Вернуть задачу в Backlog')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Вернуть задачу в Backlog'));
    await waitFor(() => expect(source.getTaskItem('date-task')).resolves.toMatchObject({ scheduledOn: null }));
  });

  test('renders the approved Plan B hierarchy instead of the development task list', async () => {
    const view = await render(<DayDashboard />);

    expect(view.getByText('Сегодня')).toBeOnTheScreen();
    expect(view.getByText('План в норме')).toBeOnTheScreen();
    expect(view.getByText('Без времени')).toBeOnTheScreen();
    expect(view.getByText('Расписание')).toBeOnTheScreen();
    expect(view.getByText('Планёрка команды')).toBeOnTheScreen();
  });
});
