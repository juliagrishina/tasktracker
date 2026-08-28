import { fireEvent, render, waitFor } from '@testing-library/react-native';

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

    await waitFor(() => expect(view.getByLabelText('Действия: Закрыть итоги встречи')).toBeOnTheScreen());
    fireEvent(view.getByLabelText('Действия: Закрыть итоги встречи'), 'contextMenu', { preventDefault: jest.fn() });

    await waitFor(() => expect(view.getByLabelText('Возобновить задачу')).toBeOnTheScreen());
  });
});
