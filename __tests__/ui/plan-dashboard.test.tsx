import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { AppServicesProvider, useAppServices } from '../../src/application/app-services-provider';
import { DayDashboard } from '../../src/ui/plan/day-dashboard';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { getDefaultSettings } from '../../src/data/default-settings';
import { ProgressRing } from '../../src/ui/plan/progress-ring';
import type { PlanDayReadModel } from '../../src/application/plan-read-model';

describe('ProgressRing', () => {
  test('announces the approved completion percentage to assistive technology', async () => {
    const view = await render(<ProgressRing label="35%" value={35} />);

    expect(view.getByLabelText('Выполнено 35%')).toBeOnTheScreen();
  });
});

describe('DayDashboard', () => {
  test('updates existing cards immediately after changing the planning timezone', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow' });
    await source.saveTaskItem({ id: 'live-timezone-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Созвон', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'live-timezone-block', taskItemId: 'live-timezone-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-03T07:00:00.000Z', endsAt: '2026-08-03T08:00:00.000Z', createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DashboardWithTimeZoneSwitch /></AppServicesProvider>);

    await waitFor(() => expect(view.getAllByText('10:00–11:00')).toHaveLength(2));
    fireEvent.press(view.getByLabelText('Переключить пояс на Berlin'));
    await waitFor(() => expect(view.getAllByText('09:00–10:00')).toHaveLength(2));
    await expect(source.getSettings()).resolves.toMatchObject({ timeZoneId: 'Europe/Berlin' });
  });

  test('renders current cards in the planning timezone while keeping the stored instant', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Berlin' });
    await source.saveTaskItem({ id: 'timezone-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Созвон', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'timezone-block', taskItemId: 'timezone-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-03T07:00:00.000Z', endsAt: '2026-08-03T08:00:00.000Z', createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-03" /></AppServicesProvider>);

    await waitFor(() => expect(view.getAllByText('09:00–10:00')).toHaveLength(2));
  });

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

  test('renders untimed items before the schedule', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'untimed-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Без времени', description: null, estimatedDurationMinutes: null, scheduledOn: '2026-08-10', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveTaskItem({ id: 'timed-task', kind: 'task', projectId: null, parentTaskId: null, title: 'По расписанию', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'timed-block', taskItemId: 'timed-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-10T09:00:00+03:00', endsAt: '2026-08-10T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-10" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByText('По расписанию')).toBeOnTheScreen());

    const renderedText = collectRenderedText(view.toJSON());
    expect(renderedText.indexOf('Без времени')).toBeLessThan(renderedText.indexOf('Расписание'));
  });

  test('uses a supplied day read-model instead of a second plan query', async () => {
    const model: PlanDayReadModel = {
      blocks: [{ id: 'model-block', taskItemId: 'model-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-10T09:00:00+03:00', endsAt: '2026-08-10T10:00:00+03:00', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', deletedAt: null }],
      loadPercent: 7.142857142857143,
      taskById: new Map([['model-task', { id: 'model-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Из общего read-model', description: null, estimatedDurationMinutes: 60, completedAt: null, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', deletedAt: null }]]),
      untimedReminders: [],
      untimedTasks: [],
    };
    const view = await render(<AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}><DayDashboard dayPlan={model} selectedDate="2026-08-10" /></AppServicesProvider>);

    expect(view.getByText('Из общего read-model')).toBeOnTheScreen();
    expect(view.getByText('7% · 1 блок')).toBeOnTheScreen();
  });

  test('renders the approved Plan B hierarchy instead of the development task list', async () => {
    const view = await render(<DayDashboard />);

    expect(view.getByText('Сегодня')).toBeOnTheScreen();
    expect(view.getByText('План в норме')).toBeOnTheScreen();
    expect(view.getByText('Без времени')).toBeOnTheScreen();
    expect(view.getByText('Расписание')).toBeOnTheScreen();
    expect(view.getByLabelText('Суточная шкала: 24 часа')).toBeOnTheScreen();
    expect(view.getByText('Планёрка команды')).toBeOnTheScreen();
  });
});

function DashboardWithTimeZoneSwitch() {
  const { settingsActions } = useAppServices();
  return <><DayDashboard selectedDate="2026-08-03" /><Pressable accessibilityLabel="Переключить пояс на Berlin" onPress={() => void settingsActions.updateTimeZone('Europe/Berlin')}><Text>Berlin</Text></Pressable></>;
}

function collectRenderedText(node: ReturnType<Awaited<ReturnType<typeof render>>['toJSON']>): readonly string[] {
  if (node === null) {
    return [];
  }

  if (typeof node === 'string') {
    return [node];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectRenderedText);
  }

  return node.children.flatMap(collectRenderedText);
}
