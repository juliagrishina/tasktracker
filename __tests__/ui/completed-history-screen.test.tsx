import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { CompletedHistoryScreen } from '../../src/ui/completed/completed-history-screen';

describe('CompletedHistoryScreen', () => {
  test('renders real completed data in the approved archive hierarchy', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem({ id: 'task-1', kind: 'task', projectId: null, parentTaskId: null, title: 'Собрать обратную связь', description: null, estimatedDurationMinutes: null, completedAt: new Date().toISOString(), createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', deletedAt: null });
    const view = await render(<AppServicesProvider seedDevelopmentData={false} source={source}><CompletedHistoryScreen /></AppServicesProvider>);

    expect(view.getByPlaceholderText('Поиск по названию')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Неделя' }).props.accessibilityState.selected).toBe(true);
    await waitFor(() => expect(view.getByText('Собрать обратную связь')).toBeOnTheScreen());
  });

  test('filters real archive entries and opens long-press actions', async () => {
    const source = createInMemoryDataSource();
    const completedAt = new Date().toISOString();
    await source.saveTaskItem({ id: 'task-1', kind: 'task', projectId: null, parentTaskId: null, title: 'Собрать обратную связь', description: null, estimatedDurationMinutes: null, completedAt, createdAt: completedAt, updatedAt: completedAt, deletedAt: null });
    await source.saveTaskItem({ id: 'task-2', kind: 'task', projectId: null, parentTaskId: null, title: 'Согласовать структуру', description: null, estimatedDurationMinutes: null, completedAt, createdAt: completedAt, updatedAt: completedAt, deletedAt: null });
    const view = await render(<AppServicesProvider seedDevelopmentData={false} source={source}><CompletedHistoryScreen /></AppServicesProvider>);

    fireEvent.changeText(view.getByPlaceholderText('Поиск по названию'), 'обратную');

    await waitFor(() => {
      expect(view.getByText('Собрать обратную связь')).toBeOnTheScreen();
      expect(view.queryByText('Согласовать структуру')).toBeNull();
    });
    fireEvent.press(view.getByLabelText('Открыть действия: Собрать обратную связь'));
    await waitFor(() => expect(view.getByLabelText('Возобновить задачу')).toBeOnTheScreen());
  });

  test('opens actions for a completed item on a browser context-menu click', async () => {
    const source = createInMemoryDataSource();
    const completedAt = new Date().toISOString();
    await source.saveTaskItem({ id: 'context-menu-completed-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Закрыть итоги встречи', description: null, estimatedDurationMinutes: null, completedAt, createdAt: completedAt, updatedAt: completedAt, deletedAt: null });
    const view = await render(<AppServicesProvider seedDevelopmentData={false} source={source}><CompletedHistoryScreen /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Открыть детали: Закрыть итоги встречи')).toBeOnTheScreen());
    fireEvent(view.getByLabelText('Открыть детали: Закрыть итоги встречи'), 'contextMenu', { preventDefault: jest.fn() });

    await waitFor(() => expect(view.getByLabelText('Возобновить задачу')).toBeOnTheScreen());
  });

  test('opens read-only details from an ordinary press without replacing the context actions', async () => {
    const source = createInMemoryDataSource();
    const completedAt = new Date().toISOString();
    await source.saveProject({ id: 'details-project', title: 'Запуск приложения', description: null, completedAt: null, createdAt: completedAt, updatedAt: completedAt, deletedAt: null });
    await source.saveTaskItem({ id: 'details-task', kind: 'task', projectId: 'details-project', parentTaskId: null, title: 'Подготовить релиз', description: 'Проверить итоговую сборку', estimatedDurationMinutes: null, completedAt, createdAt: completedAt, updatedAt: completedAt, deletedAt: null });
    const view = await render(<AppServicesProvider seedDevelopmentData={false} source={source}><CompletedHistoryScreen /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Открыть детали: Подготовить релиз')).toBeOnTheScreen());
    await act(async () => {
      fireEvent.press(view.getByLabelText('Открыть детали: Подготовить релиз'));
    });

    await waitFor(() => {
      expect(view.getByText('Детали завершённого дела')).toBeOnTheScreen();
      expect(view.getByText('Задача')).toBeOnTheScreen();
      expect(view.getByText('Проверить итоговую сборку')).toBeOnTheScreen();
      expect(view.getByText('Проект')).toBeOnTheScreen();
      expect(view.getByText('Запуск приложения')).toBeOnTheScreen();
      expect(view.queryByLabelText('Возобновить задачу')).toBeNull();
    });
  });

  test('permanently deletes a completed archive item only after an explicit confirmation', async () => {
    const source = createInMemoryDataSource();
    const completedAt = new Date().toISOString();
    await source.saveTaskItem({ id: 'permanent-delete-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Старый черновик', description: null, estimatedDurationMinutes: null, completedAt, createdAt: completedAt, updatedAt: completedAt, deletedAt: null });
    const view = await render(<AppServicesProvider seedDevelopmentData={false} source={source}><CompletedHistoryScreen /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Открыть действия: Старый черновик')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Открыть действия: Старый черновик'));
    await waitFor(() => expect(view.getByLabelText('Удалить экземпляр')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Удалить экземпляр'));

    await waitFor(() => expect(view.getByText('Удалить безвозвратно?')).toBeOnTheScreen());
    await expect(source.getTaskItem('permanent-delete-task')).resolves.toMatchObject({ id: 'permanent-delete-task' });
    await act(async () => {
      fireEvent.press(view.getByLabelText('Подтвердить безвозвратное удаление'));
    });
    await waitFor(async () => expect(await source.getTaskItem('permanent-delete-task')).toBeNull());
  });

  test('offers a separate confirmed deletion for the entire recurrence series', async () => {
    const source = createInMemoryDataSource();
    const completedAt = new Date().toISOString();
    await source.saveTaskItem({ id: 'delete-series-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Еженедельный обзор', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt: completedAt, updatedAt: completedAt, deletedAt: null });
    await source.saveRecurrenceSeries({ id: 'delete-series-id', itemKind: 'task', itemId: 'delete-series-task', frequency: 'weekly', interval: 1, startsOn: '2026-08-01', createdAt: completedAt, updatedAt: completedAt, deletedAt: null });
    await source.saveRecurrenceOccurrence({ id: 'delete-series-occurrence', seriesId: 'delete-series-id', occursOn: new Date().toISOString().slice(0, 10), cancelledAt: null, completedAt, blocksOverridden: false, taskPatch: null, reminderPatch: null, createdAt: completedAt, updatedAt: completedAt, deletedAt: null });
    const view = await render(<AppServicesProvider seedDevelopmentData={false} source={source}><CompletedHistoryScreen /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Открыть действия: Еженедельный обзор')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Открыть действия: Еженедельный обзор'));
    await waitFor(() => expect(view.getByLabelText('Удалить всю серию')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Удалить всю серию'));

    await waitFor(() => expect(view.getByText('Удалить всю серию?')).toBeOnTheScreen());
    await act(async () => {
      fireEvent.press(view.getByLabelText('Подтвердить удаление всей серии'));
    });
    await waitFor(async () => expect(await source.getTaskItem('delete-series-task')).toBeNull());
  });

  test('returns a completed one-time reminder to Backlog atomically', async () => {
    const source = createInMemoryDataSource();
    const completedAt = new Date().toISOString();
    await source.saveReminder({ id: 'completed-reminder', title: 'Подтвердить бронирование', remindsOn: '2026-08-28', periodStartOn: null, periodEndOn: null, repeatRule: null, estimatedDurationMinutes: null, completedAt, createdAt: completedAt, updatedAt: completedAt, deletedAt: null });
    const view = await render(<AppServicesProvider seedDevelopmentData={false} source={source}><CompletedHistoryScreen /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Открыть детали: Подтвердить бронирование')).toBeOnTheScreen());
    fireEvent(view.getByLabelText('Открыть детали: Подтвердить бронирование'), 'contextMenu', { preventDefault: jest.fn() });
    await waitFor(() => expect(view.getByLabelText('Вернуть напоминание в Backlog')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Вернуть напоминание в Backlog'));

    await waitFor(async () => expect(await source.getReminder('completed-reminder')).toMatchObject({ completedAt: null, remindsOn: null, periodStartOn: null, periodEndOn: null }));
  });
});
