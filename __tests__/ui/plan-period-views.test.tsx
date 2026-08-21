import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { PlanScreen } from '../../src/ui/plan/plan-screen';
import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';

describe('PlanScreen view mode control', () => {
  test('opens the Plan on the current local device date by default', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date(2026, 7, 21, 12, 0));
      const view = await render(<PlanScreen />);

      expect(view.getByText('2026-08-21')).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  test('switches from Day to Week through the approved three-option menu', async () => {
    const view = await render(<PlanScreen initialDate="2026-08-05" />);

    fireEvent.press(view.getByLabelText('Режим просмотра: День'));

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'День' })).toBeOnTheScreen();
      expect(view.getByRole('button', { name: 'Неделя' })).toBeOnTheScreen();
      expect(view.getByRole('button', { name: 'Месяц' })).toBeOnTheScreen();
    });

    fireEvent.press(view.getByLabelText('Неделя'));

    await waitFor(() => {
      expect(view.getByLabelText('Режим просмотра: Неделя')).toBeOnTheScreen();
    });
  });

  test('switches to Month without adding another view mode', async () => {
    const view = await render(<PlanScreen initialDate="2026-08-05" />);

    fireEvent.press(view.getByLabelText('Режим просмотра: День'));
    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Месяц' })).toBeOnTheScreen();
    });
    fireEvent.press(view.getByLabelText('Месяц'));

    await waitFor(() => {
      expect(view.getByLabelText('Режим просмотра: Месяц')).toBeOnTheScreen();
    });
    expect(view.queryByRole('button', { name: 'Год' })).toBeNull();
  });
});

describe('PlanScreen period views', () => {
  test('renders Week A as seven load-only days and opens the selected date in Day', async () => {
    const view = await render(<PlanScreen initialDate="2026-08-05" />);

    fireEvent.press(view.getByLabelText('Режим просмотра: День'));
    await waitFor(() => {
      expect(view.getByLabelText('Неделя')).toBeOnTheScreen();
    });
    fireEvent.press(view.getByLabelText('Неделя'));

    await waitFor(() => {
      expect(view.getAllByText('3–9 августа')).toHaveLength(2);
      expect(view.getAllByLabelText(/загрузка/)).toHaveLength(7);
      expect(view.getByLabelText('Среда, 5 августа: загрузка 0%')).toBeOnTheScreen();
    });
    expect(view.queryByText('Собрать прототип')).toBeNull();

    fireEvent.press(view.getByLabelText('Следующая неделя'));
    await waitFor(() => {
      expect(view.getAllByText('10–16 августа')).toHaveLength(2);
    });

    fireEvent.press(view.getByLabelText('Предыдущая неделя'));
    await waitFor(() => {
      expect(view.getAllByText('3–9 августа')).toHaveLength(2);
    });

    fireEvent.press(view.getByLabelText('Среда, 5 августа: загрузка 0%'));
    await waitFor(() => {
      expect(view.getByLabelText('Режим просмотра: День')).toBeOnTheScreen();
    });
  });

  test('renders Month B as a load heatmap and moves to the next month', async () => {
    const view = await render(<PlanScreen initialDate="2026-08-05" />);

    fireEvent.press(view.getByLabelText('Режим просмотра: День'));
    await waitFor(() => {
      expect(view.getByLabelText('Месяц')).toBeOnTheScreen();
    });
    fireEvent.press(view.getByLabelText('Месяц'));

    await waitFor(() => {
      expect(view.getAllByText('Август 2026')).toHaveLength(2);
      expect(view.getByLabelText('5 августа: загрузка 0%')).toBeOnTheScreen();
    });
    expect(view.queryByText('Планёрка команды')).toBeNull();

    fireEvent.press(view.getByLabelText('Следующий месяц'));
    await waitFor(() => {
      expect(view.getAllByText('Сентябрь 2026')).toHaveLength(2);
    });
  });

  test('derives Week and Month load from stored schedule blocks', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'load-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Нагрузка', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'load-block', taskItemId: 'load-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-05T09:00:00+03:00', endsAt: '2026-08-05T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><PlanScreen initialDate="2026-08-05" /></AppServicesProvider>);

    fireEvent.press(view.getByLabelText('Режим просмотра: День'));
    await waitFor(() => expect(view.getByLabelText('Неделя')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Неделя'));
    await waitFor(() => expect(view.getByLabelText('Среда, 5 августа: загрузка 7%')).toBeOnTheScreen());

    fireEvent.press(view.getByLabelText('Режим просмотра: Неделя'));
    await waitFor(() => expect(view.getByLabelText('Месяц')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Месяц'));
    await waitFor(() => expect(view.getByLabelText('5 августа: загрузка 7%')).toBeOnTheScreen());
  });

  test('opens a planned task in the editor from the Day view', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'editable-plan-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Редактируемая задача', description: null, estimatedDurationMinutes: 60, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'editable-plan-block', taskItemId: 'editable-plan-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-05T09:00:00+03:00', endsAt: '2026-08-05T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><PlanScreen initialDate="2026-08-05" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByText('Редактируемая задача')).toBeOnTheScreen());
    fireEvent.press(view.getByText('Редактируемая задача'));

    await waitFor(() => expect(view.getByDisplayValue('Редактируемая задача')).toBeOnTheScreen());
  });

  test('lets a recurring task instance choose its editing scope from the Day view', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'recurring-plan-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Повторяющаяся задача', description: null, estimatedDurationMinutes: 60, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'recurring-plan-block', taskItemId: 'recurring-plan-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-05T09:00:00+03:00', endsAt: '2026-08-05T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveRecurrenceSeries({ id: 'recurring-plan-series', itemKind: 'task', itemId: 'recurring-plan-task', frequency: 'weekly', interval: 1, startsOn: '2026-08-05', createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><PlanScreen initialDate="2026-08-05" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByText('Повторяющаяся задача')).toBeOnTheScreen());
    fireEvent.press(view.getByText('Повторяющаяся задача'));
    await waitFor(() => expect(view.getByLabelText('Редактировать повторение')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Редактировать повторение'));
    await waitFor(() => expect(view.getByText('К чему применить это изменение?')).toBeOnTheScreen());
    fireEvent.press(view.getByText('Только этот экземпляр'));
    await waitFor(() => expect(view.getByDisplayValue('Повторяющаяся задача')).toBeOnTheScreen());
    expect(view.queryByLabelText('Выбрать проект')).toBeNull();
    fireEvent.changeText(view.getByDisplayValue('Повторяющаяся задача'), 'Изменённый экземпляр');
    await waitFor(() => expect(view.getByDisplayValue('Изменённый экземпляр')).toBeOnTheScreen());
    fireEvent.press(view.getByText('Сохранить'));
    await waitFor(async () => expect((await source.listRecurrenceOccurrences('recurring-plan-series'))[0]).toMatchObject({ taskPatch: { title: 'Изменённый экземпляр' } }));
    await expect(source.getTaskItem('recurring-plan-task')).resolves.toMatchObject({ title: 'Повторяющаяся задача' });
  });

  test('keeps scope selection for a moved recurring task instance', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    const occurrenceId = 'occurrence-moved-plan-series-2026-08-05';
    await source.saveTaskItem({ id: 'moved-plan-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Перенесённая серия', description: null, estimatedDurationMinutes: 60, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveRecurrenceSeries({ id: 'moved-plan-series', itemKind: 'task', itemId: 'moved-plan-task', frequency: 'weekly', interval: 1, startsOn: '2026-08-05', createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveRecurrenceOccurrence({ id: occurrenceId, seriesId: 'moved-plan-series', occursOn: '2026-08-05', cancelledAt: null, completedAt: null, blocksOverridden: true, taskPatch: null, reminderPatch: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'moved-plan-block', taskItemId: 'moved-plan-task', occurrenceId, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-06T09:00:00+03:00', endsAt: '2026-08-06T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><PlanScreen initialDate="2026-08-06" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByText('Перенесённая серия')).toBeOnTheScreen());
    fireEvent.press(view.getByText('Перенесённая серия'));
    await waitFor(() => expect(view.getByLabelText('Редактировать повторение')).toBeOnTheScreen());
  });

  test('uses the estimate of a date-only task in Day, Week and Month load', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'estimated-plan-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Оценённая задача', description: null, estimatedDurationMinutes: 120, scheduledOn: '2026-08-05', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><PlanScreen initialDate="2026-08-05" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Выполнено 14%')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Режим просмотра: День'));
    await waitFor(() => expect(view.getByLabelText('Неделя')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Неделя'));
    await waitFor(() => expect(view.getByLabelText('Среда, 5 августа: загрузка 14%')).toBeOnTheScreen());

    fireEvent.press(view.getByLabelText('Режим просмотра: Неделя'));
    await waitFor(() => expect(view.getByLabelText('Месяц')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Месяц'));
    await waitFor(() => expect(view.getByLabelText('5 августа: загрузка 14%')).toBeOnTheScreen());
  });

});
