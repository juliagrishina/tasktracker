import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { AppServicesProvider, useAppServices } from '../../src/application/app-services-provider';
import { DayDashboard } from '../../src/ui/plan/day-dashboard';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { getDefaultSettings } from '../../src/data/default-settings';
import { ProgressRing } from '../../src/ui/plan/progress-ring';
import type { PlanDayReadModel } from '../../src/application/plan-read-model';

describe('ProgressRing', () => {
  test('announces the day load percentage to assistive technology', async () => {
    const view = await render(<ProgressRing label="35%" value={35} />);

    expect(view.getByLabelText('Загрузка 35%')).toBeOnTheScreen();
  });

  test('does not pass a boolean accessible prop to the decorative SVG', async () => {
    const view = await render(<ProgressRing label="35%" value={35} />);

    expect(JSON.stringify(view.toJSON())).not.toContain('"accessible":false');
  });
});

describe('DayDashboard', () => {
  test('keeps a completed block in the plan and marks it as completed', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow' });
    await source.saveTaskItem({ id: 'completion-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Подготовить отчёт', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'completion-block', taskItemId: 'completion-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-28T09:00:00+03:00', endsAt: '2026-08-28T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard now={new Date('2026-08-28T07:00:00.000Z')} selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByText('Удалось закончить?')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Да, завершить дело'));
    await waitFor(async () => expect(await source.getTaskItem('completion-task')).toMatchObject({ completedAt: expect.any(String) }));
    await waitFor(() => expect(view.getByLabelText('Подготовить отчёт, 09:00–10:00, выполнено, колонка 1 из 1')).toBeOnTheScreen());
    expect(view.getByLabelText('Загрузка 7%')).toBeOnTheScreen();
  });

  test('shows the next future schedule block instead of an earlier stored block', async () => {
    const createdAt = '2026-08-01T00:00:00.000Z';
    const model: PlanDayReadModel = {
      blocks: [
        { id: 'past-block', taskItemId: 'past-block-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-28T09:00:00+03:00', endsAt: '2026-08-28T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null },
        { id: 'future-block', taskItemId: 'future-block-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-28T12:00:00+03:00', endsAt: '2026-08-28T13:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null },
      ],
      loadPercent: 20,
      taskById: new Map([
        ['past-block-task', { id: 'past-block-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Прошедший блок', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null }],
        ['future-block-task', { id: 'future-block-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Ближайший блок', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null }],
      ]),
      untimedReminders: [],
      untimedTasks: [],
    };

    const view = await render(<AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}><DayDashboard dayPlan={model} now={new Date('2026-08-28T08:00:00.000Z')} selectedDate="2026-08-28" /></AppServicesProvider>);

    expect(view.getAllByText('Ближайший блок')).toHaveLength(2);
    expect(view.getAllByText('Прошедший блок')).toHaveLength(1);
  });

  test('uses the configured local date when the UTC date is still the previous day', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow' });
    await source.saveTaskItem({ id: 'local-date-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Задача локального дня', description: null, estimatedDurationMinutes: null, scheduledOn: '2026-08-11', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard now={new Date('2026-08-10T21:30:00.000Z')} /></AppServicesProvider>);

    await waitFor(() => expect(view.getByText('Сегодня')).toBeOnTheScreen());
    expect(view.getByText('2026-08-11')).toBeOnTheScreen();
    expect(view.getByText('Задача локального дня')).toBeOnTheScreen();
  });

  test('does not re-open a completion prompt for a task deferred with “Не сейчас” on the same day', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow' });
    await source.saveTaskItem({ id: 'deferred-completion-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Отложенная задача', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'deferred-completion-block', taskItemId: 'deferred-completion-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-28T09:00:00+03:00', endsAt: '2026-08-28T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });

    const now = new Date('2026-08-28T07:00:00.000Z');
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard now={now} refreshToken={0} selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByText('Удалось закончить?')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Отложить решение о завершении'));
    await waitFor(() => expect(view.queryByText('Удалось закончить?')).toBeNull());
    await waitFor(async () => expect(await source.getSettings()).toMatchObject({ completionPromptDeferredOn: '2026-08-28' }));

    await view.unmount();
    const reopenedView = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard now={now} refreshToken={1} selectedDate="2026-08-28" /></AppServicesProvider>);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(reopenedView.queryByText('Удалось закончить?')).toBeNull();
  });

  test('offers a linked follow-up reminder after completion and creates it for the chosen date', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow' });
    await source.saveTaskItem({ id: 'follow-up-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Подготовить отчёт', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'follow-up-block', taskItemId: 'follow-up-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-28T09:00:00+03:00', endsAt: '2026-08-28T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard now={new Date('2026-08-28T07:00:00.000Z')} selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByText('Удалось закончить?')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Да, завершить дело'));
    await waitFor(() => expect(view.getByText('Создать связанное напоминание?')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Напомнить через 3 дня'));

    await waitFor(async () => expect(await source.listReminders()).toMatchObject([{
      title: 'Проверить: Подготовить отчёт',
      remindsOn: '2026-08-31',
      linkedTaskItemId: 'follow-up-task',
      linkedOccurrenceOn: null,
    }]));
  });

  test('opens an evening review without changing unfinished items', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow' });
    await source.saveTaskItem({ id: 'review-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Отправить отчёт', description: null, estimatedDurationMinutes: null, scheduledOn: '2026-08-28', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveReminder({ id: 'review-reminder', title: 'Проверить письмо', remindsOn: '2026-08-28', periodStartOn: null, periodEndOn: null, repeatRule: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard now={new Date('2026-08-28T18:30:00.000Z')} selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Открыть вечернюю проверку')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Открыть вечернюю проверку'));
    await waitFor(() => expect(view.getByText('Вечерняя проверка')).toBeOnTheScreen());
    expect(view.getAllByText('Отправить отчёт')).toHaveLength(2);
    expect(view.getAllByText('Проверить письмо')).toHaveLength(2);
    await fireEvent.press(view.getByLabelText('Закрыть вечернюю проверку'));

    await expect(source.getTaskItem('review-task')).resolves.toMatchObject({ completedAt: null, scheduledOn: '2026-08-28' });
    await expect(source.getReminder('review-reminder')).resolves.toMatchObject({ completedAt: null, remindsOn: '2026-08-28' });
  });

  test('opens explicit actions for an untimed task after a long press', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'quick-actions-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Подготовить материалы', description: null, estimatedDurationMinutes: 30, scheduledOn: '2026-08-28', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Без времени: Подготовить материалы')).toBeOnTheScreen());
    await fireEvent(view.getByLabelText('Без времени: Подготовить материалы'), 'longPress');

    await waitFor(() => expect(view.getByText('Действия с задачей')).toBeOnTheScreen());
    expect(view.getByLabelText('Выполнить задачу')).toBeOnTheScreen();
    expect(view.getByLabelText('Вернуть задачу в Backlog')).toBeOnTheScreen();
    expect(view.getByLabelText('Удалить задачу')).toBeOnTheScreen();
  });

  test('opens explicit actions for a planned task on a browser context-menu click', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'context-menu-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Подготовить повестку', description: null, estimatedDurationMinutes: 30, scheduledOn: '2026-08-28', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Без времени: Подготовить повестку')).toBeOnTheScreen());
    await fireEvent(view.getByLabelText('Без времени: Подготовить повестку'), 'contextMenu', { preventDefault: jest.fn() });

    await waitFor(() => expect(view.getByText('Действия с задачей')).toBeOnTheScreen());
  });

  test('opens quick actions for a one-time reminder on a browser context-menu click', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveReminder({ id: 'context-menu-reminder', title: 'Подтвердить бронирование', remindsOn: '2026-08-28', periodStartOn: null, periodEndOn: null, repeatRule: null, estimatedDurationMinutes: 30, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Без времени: Подтвердить бронирование')).toBeOnTheScreen());
    await fireEvent(view.getByLabelText('Без времени: Подтвердить бронирование'), 'contextMenu', { preventDefault: jest.fn() });

    await waitFor(() => expect(view.getByText('Действия с напоминанием')).toBeOnTheScreen());
    expect(view.getByLabelText('Выполнить напоминание')).toBeOnTheScreen();
    expect(view.getByLabelText('Удалить напоминание')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Выполнить напоминание'));
    await waitFor(async () => expect(await source.getReminder('context-menu-reminder')).toMatchObject({ completedAt: expect.any(String) }));
  });

  test('opens the same quick actions for a one-time reminder after a long press', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveReminder({ id: 'long-press-reminder', title: 'Подтвердить участие', remindsOn: '2026-08-28', periodStartOn: null, periodEndOn: null, repeatRule: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Без времени: Подтвердить участие')).toBeOnTheScreen());
    await fireEvent(view.getByLabelText('Без времени: Подтвердить участие'), 'longPress');

    await waitFor(() => expect(view.getByText('Действия с напоминанием')).toBeOnTheScreen());
  });

  test('returns a one-time reminder to Backlog from quick actions', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveReminder({ id: 'return-reminder', title: 'Выбрать подарок', remindsOn: '2026-08-28', periodStartOn: null, periodEndOn: null, repeatRule: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Без времени: Выбрать подарок')).toBeOnTheScreen());
    await fireEvent(view.getByLabelText('Без времени: Выбрать подарок'), 'contextMenu', { preventDefault: jest.fn() });
    await waitFor(() => expect(view.getByLabelText('Вернуть напоминание в Backlog')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Вернуть напоминание в Backlog'));

    await waitFor(async () => expect(await source.getReminder('return-reminder')).toMatchObject({ remindsOn: null, periodStartOn: null, periodEndOn: null }));
  });

  test('opens explicit actions for a scheduled task on a browser context-menu click', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'scheduled-context-menu-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Провести созвон', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'scheduled-context-menu-block', taskItemId: 'scheduled-context-menu-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-28T09:00:00+03:00', endsAt: '2026-08-28T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Провести созвон, 09:00–10:00, колонка 1 из 1')).toBeOnTheScreen());
    await fireEvent(view.getByLabelText('Провести созвон, 09:00–10:00, колонка 1 из 1'), 'contextMenu', { preventDefault: jest.fn() });

    await waitFor(() => expect(view.getByText('Действия с задачей')).toBeOnTheScreen());
  });

  test('shows resume for a completed recurring instance in plan actions', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'completed-recurring-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Завершённый повтор', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'completed-recurring-block', taskItemId: 'completed-recurring-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-28T09:00:00+03:00', endsAt: '2026-08-28T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveRecurrenceSeries({ id: 'completed-recurring-series', itemKind: 'task', itemId: 'completed-recurring-task', frequency: 'weekly', interval: 1, startsOn: '2026-08-28', createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveRecurrenceOccurrence({ id: 'completed-recurring-occurrence', seriesId: 'completed-recurring-series', occursOn: '2026-08-28', cancelledAt: null, completedAt: '2026-08-28T10:00:00.000Z', blocksOverridden: false, taskPatch: null, reminderPatch: null, createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Завершённый повтор, 09:00–10:00, выполнено, колонка 1 из 1')).toBeOnTheScreen());
    await fireEvent(view.getByLabelText('Завершённый повтор, 09:00–10:00, выполнено, колонка 1 из 1'), 'contextMenu', { preventDefault: jest.fn() });

    await waitFor(() => expect(view.getByLabelText('Возобновить задачу')).toBeOnTheScreen());
  });

  test('completes a recurring plan instance without asking for a series scope', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'quick-complete-recurring-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Повтор для завершения', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'quick-complete-recurring-block', taskItemId: 'quick-complete-recurring-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-28T09:00:00+03:00', endsAt: '2026-08-28T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveRecurrenceSeries({ id: 'quick-complete-recurring-series', itemKind: 'task', itemId: 'quick-complete-recurring-task', frequency: 'weekly', interval: 1, startsOn: '2026-08-28', createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Повтор для завершения, 09:00–10:00, колонка 1 из 1')).toBeOnTheScreen());
    await fireEvent(view.getByLabelText('Повтор для завершения, 09:00–10:00, колонка 1 из 1'), 'contextMenu', { preventDefault: jest.fn() });
    await waitFor(() => expect(view.getByLabelText('Выполнить задачу')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Выполнить задачу'));

    await waitFor(async () => expect(await source.listRecurrenceOccurrences('quick-complete-recurring-series')).toMatchObject([{ occursOn: '2026-08-28', completedAt: expect.any(String) }]));
    expect(view.queryByText('К чему применить это изменение?')).toBeNull();
  });

  test('requires an explicit whole-series confirmation before deleting an active recurring reminder', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveReminder({ id: 'active-recurring-reminder', title: 'Полить цветы', remindsOn: '2026-08-28', periodStartOn: null, periodEndOn: null, repeatRule: { frequency: 'weekly', interval: 1 }, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveRecurrenceSeries({ id: 'active-recurring-reminder-series', itemKind: 'reminder', itemId: 'active-recurring-reminder', frequency: 'weekly', interval: 1, startsOn: '2026-08-28', createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Без времени: Полить цветы')).toBeOnTheScreen());
    await fireEvent(view.getByLabelText('Без времени: Полить цветы'), 'contextMenu', { preventDefault: jest.fn() });
    await waitFor(() => expect(view.getByLabelText('Удалить напоминание')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Удалить напоминание'));
    await waitFor(() => expect(view.getByText('Всю серию')).toBeOnTheScreen());
    await fireEvent.press(view.getByText('Всю серию'));

    await waitFor(() => expect(view.getByText('Удалить всю серию?')).toBeOnTheScreen());
    expect(view.queryByText('К чему применить это изменение?')).toBeNull();
    await expect(source.getReminder('active-recurring-reminder')).resolves.toMatchObject({ id: 'active-recurring-reminder' });
    await fireEvent.press(view.getByLabelText('Подтвердить удаление всей серии'));
    await waitFor(async () => expect(await source.getReminder('active-recurring-reminder')).toBeNull());
  });

  test('opens an occurrence editor when an active recurring plan instance is pressed', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    const onEditRecurrence = jest.fn();
    await source.saveTaskItem({ id: 'editable-recurring-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Редактируемый повтор', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'editable-recurring-block', taskItemId: 'editable-recurring-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-28T09:00:00+03:00', endsAt: '2026-08-28T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveRecurrenceSeries({ id: 'editable-recurring-series', itemKind: 'task', itemId: 'editable-recurring-task', frequency: 'weekly', interval: 1, startsOn: '2026-08-28', createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard onEditRecurrence={onEditRecurrence} selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Редактируемый повтор, 09:00–10:00, колонка 1 из 1')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Редактируемый повтор, 09:00–10:00, колонка 1 из 1'));

    await waitFor(() => expect(view.getByLabelText('Редактировать только выбранный экземпляр')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Редактировать только выбранный экземпляр'));
    await waitFor(() => expect(onEditRecurrence).toHaveBeenCalledWith(expect.objectContaining({ id: 'editable-recurring-task' }), 'editable-recurring-series', '2026-08-28'));
  });

  test('offers explicit unfinished actions and continues the task by 30 minutes', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow' });
    await source.saveTaskItem({ id: 'unfinished-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Незавершённый отчёт', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'unfinished-block', taskItemId: 'unfinished-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-28T09:00:00+03:00', endsAt: '2026-08-28T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });

    const editTask = jest.fn();
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard now={new Date('2026-08-28T07:00:00.000Z')} onEditTask={editTask} selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Нет, выбрать действие для незавершённого дела')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Нет, выбрать действие для незавершённого дела'));
    await waitFor(() => expect(view.getByText('Что сделать с незавершённым делом?')).toBeOnTheScreen());
    expect(view.getByLabelText('Перенести дело на другое время')).toBeOnTheScreen();
    expect(view.getByLabelText('Причина возврата в Backlog')).toBeOnTheScreen();
    expect(view.getByLabelText('Вернуть дело в Backlog')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Продолжить дело на 30 минут'));
    await waitFor(async () => expect(await source.getScheduleBlock('unfinished-block')).toMatchObject({ endsAt: '2026-08-28T07:30:00.000Z' }));
    expect(editTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'unfinished-task' }));
  });

  test('shows a completed date-only task and keeps its estimate in the day load', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow' });
    await source.saveTaskItem({ id: 'completed-date-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Завершённое дело без времени', description: null, estimatedDurationMinutes: 60, scheduledOn: '2026-08-28', periodStartOn: null, periodEndOn: null, completedAt: '2026-08-28T10:00:00.000Z', createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Без времени: Завершённое дело без времени, выполнено')).toBeOnTheScreen());
    expect(view.getByLabelText('Загрузка 7%')).toBeOnTheScreen();
  });

  test('completes only the prompted recurring occurrence', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow' });
    await source.saveTaskItem({ id: 'recurring-completion-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Повторяющийся отчёт', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'recurring-completion-block', taskItemId: 'recurring-completion-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-21T09:00:00+03:00', endsAt: '2026-08-21T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveRecurrenceSeries({ id: 'recurring-completion-series', itemKind: 'task', itemId: 'recurring-completion-task', frequency: 'weekly', interval: 1, startsOn: '2026-08-21', createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard now={new Date('2026-08-28T07:00:00.000Z')} selectedDate="2026-08-28" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByText('Удалось закончить?')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Да, завершить дело'));
    await waitFor(async () => expect(await source.listRecurrenceOccurrences('recurring-completion-series')).toMatchObject([{ occursOn: '2026-08-28', completedAt: expect.any(String) }]));
    await waitFor(() => expect(view.getByLabelText('Повторяющийся отчёт, 09:00–10:00, выполнено, колонка 1 из 1')).toBeOnTheScreen());
    await expect(source.getTaskItem('recurring-completion-task')).resolves.toMatchObject({ completedAt: null });
    await expect(source.listRecurrenceOccurrences('recurring-completion-series')).resolves.toHaveLength(1);
  });

  test('updates existing cards immediately after changing the planning timezone', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow' });
    await source.saveTaskItem({ id: 'live-timezone-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Созвон', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'live-timezone-block', taskItemId: 'live-timezone-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-03T07:00:00.000Z', endsAt: '2026-08-03T08:00:00.000Z', createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DashboardWithTimeZoneSwitch /></AppServicesProvider>);

    await waitFor(() => expect(view.getAllByText('10:00–11:00')).toHaveLength(2));
    await fireEvent.press(view.getByLabelText('Переключить пояс на Berlin'));
    await waitFor(() => expect(view.getAllByText('09:00–10:00')).toHaveLength(2));
    await expect(source.getSettings()).resolves.toMatchObject({ timeZoneId: 'Europe/Berlin' });
  });

  test('renders current cards in the planning timezone while keeping the stored instant', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Berlin', timeZoneMode: 'manual' });
    await source.saveTaskItem({ id: 'timezone-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Созвон', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'timezone-block', taskItemId: 'timezone-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-03T07:00:00.000Z', endsAt: '2026-08-03T08:00:00.000Z', createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-03" /></AppServicesProvider>);

    await waitFor(() => expect(view.getAllByText('09:00–10:00')).toHaveLength(2));
  });

  test('opens the editor for a date-only task', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    const onEditTask = jest.fn();
    await source.saveTaskItem({ id: 'date-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Задача без времени', description: null, estimatedDurationMinutes: null, scheduledOn: '2026-08-10', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard onEditTask={onEditTask} selectedDate="2026-08-10" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByText('Задача без времени')).toBeOnTheScreen());
    await fireEvent.press(view.getByText('Задача без времени'));
    await waitFor(() => expect(onEditTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'date-task' })));
  });

  test('does not describe untimed tasks as precisely scheduled', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'untimed-copy-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Без времени в две строки', description: null, estimatedDurationMinutes: null, scheduledOn: '2026-08-10', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-10" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByText('Без времени в две строки')).toBeOnTheScreen());
    expect(view.queryByText('Точно запланировано')).toBeNull();
  });

  test('shows the untimed label only in the section heading', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'untimed-label-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Задача без повторной подписи', description: null, estimatedDurationMinutes: null, scheduledOn: '2026-08-10', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-10" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByText('Задача без повторной подписи')).toBeOnTheScreen());
    expect(view.getAllByText('Без времени')).toHaveLength(1);
  });

  test('renders untimed items before the schedule', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'untimed-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Без времени', description: null, estimatedDurationMinutes: null, scheduledOn: '2026-08-10', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveTaskItem({ id: 'timed-task', kind: 'task', projectId: null, parentTaskId: null, title: 'По расписанию', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'timed-block', taskItemId: 'timed-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-10T09:00:00+03:00', endsAt: '2026-08-10T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });

    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-10" /></AppServicesProvider>);

    await waitFor(() => expect(view.getAllByText('По расписанию')).toHaveLength(2));

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

    expect(view.getAllByText('Из общего read-model')).toHaveLength(2);
    expect(view.getByText('7% · 1 блок')).toBeOnTheScreen();
  });

  test('renders the approved Plan B hierarchy from a fixed current date instead of the development task list', async () => {
    const view = await render(<DayDashboard now={new Date('2026-08-10T12:00:00.000Z')} />);

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

function collectRenderedText(node: unknown): readonly string[] {
  if (node === null) {
    return [];
  }

  if (typeof node === 'string') {
    return [node];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectRenderedText);
  }

  if (typeof node === 'object' && 'children' in node && Array.isArray(node.children)) {
    return node.children.flatMap(collectRenderedText);
  }

  return [];
}
