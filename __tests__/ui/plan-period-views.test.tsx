import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { PlanScreen } from '../../src/ui/plan/plan-screen';
import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { getDefaultSettings } from '../../src/data/default-settings';
import { formatPlanWeekRange } from '../../src/ui/plan/plan-period-model';

async function createMoscowDataSource() {
  const source = createInMemoryDataSource();
  await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow', timeZoneMode: 'manual' });
  return source;
}

describe('PlanScreen view mode control', () => {
  test('opens the Plan on the current local device date by default', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      jest.setSystemTime(new Date(2026, 7, 21, 12, 0));
      const view = await render(<PlanScreen />);

      expect(view.getAllByText('2026-08-21')).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });

  test('switches from Day to Week through the approved three-option menu', async () => {
    const view = await render(<PlanScreen initialDate="2026-08-05" />);

    await fireEvent.press(view.getByLabelText('Режим просмотра: День'));

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'День' })).toBeOnTheScreen();
      expect(view.getByRole('button', { name: 'Неделя' })).toBeOnTheScreen();
      expect(view.getByRole('button', { name: 'Месяц' })).toBeOnTheScreen();
    });

    await fireEvent.press(view.getByLabelText('Неделя'));

    await waitFor(() => {
      expect(view.getByLabelText('Режим просмотра: Неделя')).toBeOnTheScreen();
    });
  });

  test('switches to Month without adding another view mode', async () => {
    const view = await render(<PlanScreen initialDate="2026-08-05" />);

    await fireEvent.press(view.getByLabelText('Режим просмотра: День'));
    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Месяц' })).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Месяц'));

    await waitFor(() => {
      expect(view.getByLabelText('Режим просмотра: Месяц')).toBeOnTheScreen();
    });
    expect(view.queryByRole('button', { name: 'Год' })).toBeNull();
  });
});

describe('PlanScreen period views', () => {
  test('navigates the Day view one calendar day across a year boundary', async () => {
    const view = await render(<PlanScreen initialDate="2026-12-31" />);

    await fireEvent.press(view.getByLabelText('Следующий день'));
    await waitFor(() => expect(view.getAllByText('2027-01-01')).toHaveLength(2));

    await fireEvent.press(view.getByLabelText('Предыдущий день'));
    await waitFor(() => expect(view.getAllByText('2026-12-31')).toHaveLength(2));
  });

  test('renders Week A as seven load-only days and opens the selected date in Day', async () => {
    const view = await render(<PlanScreen initialDate="2026-08-05" />);

    await fireEvent.press(view.getByLabelText('Режим просмотра: День'));
    await waitFor(() => {
      expect(view.getByLabelText('Неделя')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Неделя'));

    await waitFor(() => {
      expect(view.getAllByText('3–9 августа')).toHaveLength(2);
      expect(view.getAllByLabelText(/загрузка/)).toHaveLength(7);
      expect(view.getByLabelText('Среда, 5 августа: загрузка 0%')).toBeOnTheScreen();
    });
    expect(view.queryByText('Собрать прототип')).toBeNull();

    await fireEvent.press(view.getByLabelText('Следующая неделя'));
    await waitFor(() => {
      expect(view.getAllByText('10–16 августа')).toHaveLength(2);
    });

    await fireEvent.press(view.getByLabelText('Предыдущая неделя'));
    await waitFor(() => {
      expect(view.getAllByText('3–9 августа')).toHaveLength(2);
    });

    await fireEvent.press(view.getByLabelText('Среда, 5 августа: загрузка 0%'));
    await waitFor(() => {
      expect(view.getByLabelText('Режим просмотра: День')).toBeOnTheScreen();
    });
    expect(view.getByText('План')).toBeOnTheScreen();
    expect(view.getByLabelText('Перейти к сегодняшнему дню')).toBeOnTheScreen();
    expect(view.getAllByText('2026-08-05')).toHaveLength(2);
  });

  test('renders Month B as a load heatmap and moves to the next month', async () => {
    const view = await render(<PlanScreen initialDate="2026-08-05" />);

    await fireEvent.press(view.getByLabelText('Режим просмотра: День'));
    await waitFor(() => {
      expect(view.getByLabelText('Месяц')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Месяц'));

    await waitFor(() => {
      expect(view.getAllByText('Август 2026')).toHaveLength(2);
      expect(view.getByLabelText('5 августа: загрузка 0%')).toBeOnTheScreen();
    });
    expect(view.queryByText('Планёрка команды')).toBeNull();

    await fireEvent.press(view.getByLabelText('Следующий месяц'));
    await waitFor(() => {
      expect(view.getAllByText('Сентябрь 2026')).toHaveLength(2);
    });
  });

  test('returns a period view to the current local day', async () => {
    const now = new Date();
    const toLocalIsoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const today = toLocalIsoDate(now);
    const twoWeeksEarlier = new Date(now);
    twoWeeksEarlier.setDate(twoWeeksEarlier.getDate() - 14);
    const oneWeekEarlier = new Date(now);
    oneWeekEarlier.setDate(oneWeekEarlier.getDate() - 7);
    const view = await render(<PlanScreen initialDate={toLocalIsoDate(twoWeeksEarlier)} />);

    await fireEvent.press(view.getByLabelText('Режим просмотра: День'));
    await waitFor(() => expect(view.getByLabelText('Неделя')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Неделя'));
    await waitFor(() => expect(view.getAllByText(formatPlanWeekRange(toLocalIsoDate(twoWeeksEarlier)))).toHaveLength(2));
    await fireEvent.press(view.getByLabelText('Следующая неделя'));
    await waitFor(() => expect(view.getAllByText(formatPlanWeekRange(toLocalIsoDate(oneWeekEarlier)))).toHaveLength(2));

    await fireEvent.press(view.getByLabelText('Перейти к сегодняшнему дню'));

    await waitFor(() => expect(view.getAllByText(formatPlanWeekRange(today))).toHaveLength(2));
  });

  test('derives Week and Month load from stored schedule blocks', async () => {
    const source = await createMoscowDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'load-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Нагрузка', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'load-block', taskItemId: 'load-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-05T09:00:00+03:00', endsAt: '2026-08-05T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><PlanScreen initialDate="2026-08-05" /></AppServicesProvider>);

    await fireEvent.press(view.getByLabelText('Режим просмотра: День'));
    await waitFor(() => expect(view.getByLabelText('Неделя')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Неделя'));
    await waitFor(() => expect(view.getByLabelText('Среда, 5 августа: загрузка 7%')).toBeOnTheScreen());

    await fireEvent.press(view.getByLabelText('Режим просмотра: Неделя'));
    await waitFor(() => expect(view.getByLabelText('Месяц')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Месяц'));
    await waitFor(() => expect(view.getByLabelText('5 августа: загрузка 7%')).toBeOnTheScreen());
  });

  test('opens a planned task in the editor from the Day view', async () => {
    const source = await createMoscowDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'editable-plan-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Редактируемая задача', description: null, estimatedDurationMinutes: 60, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'editable-plan-block', taskItemId: 'editable-plan-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-05T09:00:00+03:00', endsAt: '2026-08-05T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><PlanScreen initialDate="2026-08-05" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Редактируемая задача, 09:00–10:00, колонка 1 из 1')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Редактируемая задача, 09:00–10:00, колонка 1 из 1'));

    await waitFor(() => expect(view.getByDisplayValue('Редактируемая задача')).toBeOnTheScreen());
  });

  test('opens a one-time reminder in the editor from the Day view', async () => {
    const source = await createMoscowDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveReminder({ id: 'editable-plan-reminder', title: 'Подтвердить бронирование', remindsOn: '2026-08-05', periodStartOn: null, periodEndOn: null, repeatRule: null, estimatedDurationMinutes: 60, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><PlanScreen initialDate="2026-08-05" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByText('Подтвердить бронирование')).toBeOnTheScreen());
    await fireEvent.press(view.getByText('Подтвердить бронирование'));

    await waitFor(() => expect(view.getByDisplayValue('Подтвердить бронирование')).toBeOnTheScreen());
    expect(view.getByLabelText('Выполнить дело из редактора')).toBeOnTheScreen();
    expect(view.getByLabelText('Удалить дело из редактора')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Выполнить дело из редактора'));

    await waitFor(async () => expect(await source.getReminder('editable-plan-reminder')).toMatchObject({ completedAt: expect.any(String) }));
    await waitFor(() => expect(view.getByLabelText('Без времени: Подтвердить бронирование, выполнено')).toBeOnTheScreen());
    expect(view.getByLabelText('Загрузка 7%')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Без времени: Подтвердить бронирование, выполнено'));
    await waitFor(() => expect(view.getByLabelText('Возобновить дело из редактора')).toBeOnTheScreen());
  });

  test('opens the task linked to a timeline block in the editor', async () => {
    const source = await createMoscowDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'parent-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Родительская задача', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveTaskItem({ id: 'timeline-subtask', kind: 'subtask', projectId: null, parentTaskId: 'parent-task', title: 'Связанная подзадача', description: null, estimatedDurationMinutes: 60, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'timeline-subtask-block', taskItemId: 'timeline-subtask', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-05T09:00:00+03:00', endsAt: '2026-08-05T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><PlanScreen initialDate="2026-08-05" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Связанная подзадача, 09:00–10:00, колонка 1 из 1')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Связанная подзадача, 09:00–10:00, колонка 1 из 1'));

    await waitFor(() => expect(view.getByDisplayValue('Связанная подзадача')).toBeOnTheScreen());
    expect(view.queryByDisplayValue('Родительская задача')).toBeNull();
  });

  test('lets a recurring task instance choose its editing scope from the Day view', async () => {
    const source = await createMoscowDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'recurring-plan-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Повторяющаяся задача', description: null, estimatedDurationMinutes: 60, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'recurring-plan-block', taskItemId: 'recurring-plan-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-05T09:00:00+03:00', endsAt: '2026-08-05T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveRecurrenceSeries({ id: 'recurring-plan-series', itemKind: 'task', itemId: 'recurring-plan-task', frequency: 'weekly', interval: 1, startsOn: '2026-08-05', createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><PlanScreen initialDate="2026-08-05" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Повторяющаяся задача, 09:00–10:00, колонка 1 из 1')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Повторяющаяся задача, 09:00–10:00, колонка 1 из 1'));
    await waitFor(() => expect(view.getByText('К чему применить это изменение?')).toBeOnTheScreen());
    expect(view.getByText('Серию с этой даты')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Только этот экземпляр'));
    await waitFor(() => expect(view.getByDisplayValue('Повторяющаяся задача')).toBeOnTheScreen());
    expect(view.getByLabelText('Выбрать проект')).toBeOnTheScreen();
    expect(view.getByLabelText('Дата задачи')).toBeOnTheScreen();
    expect(view.getByLabelText('Дата блока 1')).toBeOnTheScreen();
    await fireEvent.changeText(view.getByDisplayValue('Повторяющаяся задача'), 'Изменённый экземпляр');
    await waitFor(() => expect(view.getByDisplayValue('Изменённый экземпляр')).toBeOnTheScreen());
    await fireEvent.press(view.getByText('Сохранить'));
    await waitFor(async () => expect((await source.listRecurrenceOccurrences('recurring-plan-series'))[0]).toMatchObject({ taskPatch: { title: 'Изменённый экземпляр' } }));
    await expect(source.getTaskItem('recurring-plan-task')).resolves.toMatchObject({ title: 'Повторяющаяся задача' });
  });

  test('edits a recurring task series forward from the selected plan date', async () => {
    const source = await createMoscowDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'forward-series-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Исходная серия', description: null, estimatedDurationMinutes: 60, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'forward-series-block', taskItemId: 'forward-series-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-05T09:00:00+03:00', endsAt: '2026-08-05T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveRecurrenceSeries({ id: 'forward-series', itemKind: 'task', itemId: 'forward-series-task', frequency: 'weekly', interval: 1, startsOn: '2026-08-05', createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><PlanScreen initialDate="2026-08-12" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Исходная серия, 09:00–10:00, колонка 1 из 1')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Исходная серия, 09:00–10:00, колонка 1 из 1'));
    await waitFor(() => expect(view.getByText('Серию с этой даты')).toBeOnTheScreen());
    await fireEvent.press(view.getByText('Серию с этой даты'));
    await waitFor(() => expect(view.getByDisplayValue('Исходная серия')).toBeOnTheScreen());
    await fireEvent.changeText(view.getByDisplayValue('Исходная серия'), 'Обновлённая серия');
    await waitFor(() => expect(view.getByDisplayValue('Обновлённая серия')).toBeOnTheScreen());
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(async () => expect(await source.listRecurrenceRevisions('forward-series')).toMatchObject([
      { effectiveFrom: '2026-08-12', taskPatch: { title: 'Обновлённая серия' } },
    ]));
    await expect(source.getTaskItem('forward-series-task')).resolves.toMatchObject({ title: 'Исходная серия' });
    await waitFor(() => expect(view.getByLabelText('Обновлённая серия, 09:00–10:00, колонка 1 из 1')).toBeOnTheScreen());
  });

  test('keeps scope selection for a moved recurring task instance', async () => {
    const source = await createMoscowDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    const occurrenceId = 'occurrence-moved-plan-series-2026-08-05';
    await source.saveTaskItem({ id: 'moved-plan-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Перенесённая серия', description: null, estimatedDurationMinutes: 60, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveRecurrenceSeries({ id: 'moved-plan-series', itemKind: 'task', itemId: 'moved-plan-task', frequency: 'weekly', interval: 1, startsOn: '2026-08-05', createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveRecurrenceOccurrence({ id: occurrenceId, seriesId: 'moved-plan-series', occursOn: '2026-08-05', cancelledAt: null, completedAt: null, blocksOverridden: true, taskPatch: null, reminderPatch: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'moved-plan-block', taskItemId: 'moved-plan-task', occurrenceId, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-06T09:00:00+03:00', endsAt: '2026-08-06T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><PlanScreen initialDate="2026-08-06" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Перенесённая серия, 09:00–10:00, колонка 1 из 1')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Перенесённая серия, 09:00–10:00, колонка 1 из 1'));
    await waitFor(() => expect(view.getByLabelText('Редактировать повторение')).toBeOnTheScreen());
  });

  test('uses the estimate of a date-only task in Day, Week and Month load', async () => {
    const source = await createMoscowDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'estimated-plan-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Оценённая задача', description: null, estimatedDurationMinutes: 120, scheduledOn: '2026-08-05', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><PlanScreen initialDate="2026-08-05" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Загрузка 14%')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Режим просмотра: День'));
    await waitFor(() => expect(view.getByLabelText('Неделя')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Неделя'));
    await waitFor(() => expect(view.getByLabelText('Среда, 5 августа: загрузка 14%')).toBeOnTheScreen());

    await fireEvent.press(view.getByLabelText('Режим просмотра: Неделя'));
    await waitFor(() => expect(view.getByLabelText('Месяц')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Месяц'));
    await waitFor(() => expect(view.getByLabelText('5 августа: загрузка 14%')).toBeOnTheScreen());
  });

});
