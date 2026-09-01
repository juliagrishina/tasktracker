import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import type { Reminder, TaskItem } from '../../src/domain/entities';
import { ItemFormSheet } from '../../src/ui/backlog/item-form-sheet';
import { BacklogRootScreen } from '../../src/ui/backlog/backlog-root-screen';

describe('Backlog item form', () => {
  test('lets a recurring reminder select days of the week', async () => {
    const view = await render(<AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}><BacklogRootScreen /></AppServicesProvider>);
    await waitFor(() => expect(view.getByLabelText('Добавить элемент')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Добавить элемент'));
    await waitFor(() => expect(view.getByText('Новое напоминание')).toBeOnTheScreen());
    await fireEvent.press(view.getByText('Новое напоминание'));
    await waitFor(() => expect(view.getByText('Каждую неделю')).toBeOnTheScreen());
    await fireEvent.press(view.getByText('Каждую неделю'));
    await waitFor(() => expect(view.getByLabelText('Пн')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Пн'));
  });

  test('keeps the form open and displays validation when saving a blank title', async () => {
    const view = await render(
      <AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}>
        <BacklogRootScreen />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Добавить элемент')).toBeOnTheScreen();
    });

    await fireEvent.press(view.getByLabelText('Добавить элемент'));
    await waitFor(() => {
      expect(view.getByText('Новая задача')).toBeTruthy();
    });
    await fireEvent.press(view.getByText('Новая задача'));
    await waitFor(() => {
      expect(view.getByText('Сохранить')).toBeTruthy();
    });
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(() => {
      expect(view.getByText('Название обязательно')).toBeTruthy();
    });
    expect(view.getByLabelText('Название')).toBeTruthy();
  });

  test.each([
    { kind: 'task' as const, expectedType: 'task' as const },
    { kind: 'subtask' as const, expectedType: 'subtask' as const },
  ])('reports successful planning for a $kind after it leaves Backlog', async ({ kind, expectedType }) => {
    const source = createInMemoryDataSource();
    const sharedItem = {
      id: `${kind}-to-plan`,
      projectId: null,
      description: null,
      estimatedDurationMinutes: 30,
      scheduledOn: null,
      periodStartOn: null,
      periodEndOn: null,
      completedAt: null,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z',
      deletedAt: null,
    };
    const item: TaskItem = kind === 'task'
      ? { ...sharedItem, kind: 'task', parentTaskId: null, title: 'Задача для планирования' }
      : { ...sharedItem, kind: 'subtask', parentTaskId: 'parent-task', title: 'Подзадача для планирования' };
    if (kind === 'subtask') {
      await source.saveTaskItem({
        ...item,
        id: 'parent-task',
        kind: 'task',
        parentTaskId: null,
        title: 'Задача-родитель',
      });
    }
    await source.saveTaskItem(item);
    const onPlanned = jest.fn();
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <ItemFormSheet
          item={item}
          mode="edit"
          onClose={() => {}}
          onPlanned={onPlanned}
          planningContext={{ defaultDate: '2026-09-03' }}
          type={kind}
          visible
        />
      </AppServicesProvider>,
    );

    await waitFor(() => expect(view.getByText('Сохранить')).toBeOnTheScreen());
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(() => expect(onPlanned).toHaveBeenCalledWith({
      plannedOn: '2026-09-03',
      title: item.title,
      type: expectedType,
    }));
  });

  test('reports successful planning for an untimed reminder', async () => {
    const source = createInMemoryDataSource();
    const reminder: Reminder = {
      id: 'reminder-to-plan',
      title: 'Напоминание для планирования',
      remindsOn: null,
      periodStartOn: null,
      periodEndOn: null,
      repeatRule: null,
      estimatedDurationMinutes: null,
      completedAt: null,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z',
      deletedAt: null,
    };
    await source.saveReminder(reminder);
    const onPlanned = jest.fn();
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <ItemFormSheet
          item={reminder}
          mode="edit"
          onClose={() => {}}
          onPlanned={onPlanned}
          planningContext={{ defaultDate: '2026-09-03' }}
          type="reminder"
          visible
        />
      </AppServicesProvider>,
    );

    await waitFor(() => expect(view.getByText('Сохранить')).toBeOnTheScreen());
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(() => expect(onPlanned).toHaveBeenCalledWith({
      plannedOn: '2026-09-03',
      title: reminder.title,
      type: 'reminder',
    }));
  });
});
