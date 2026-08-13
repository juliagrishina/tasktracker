import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createSubtask, createTask } from '../../src/application/backlog-use-cases';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { ItemDetailActions } from '../../src/ui/backlog/item-detail-actions';

describe('Backlog item actions', () => {
  test.each(['task', 'subtask', 'reminder'] as const)(
    'opens the planning editor for a %s instead of showing a future-stage placeholder',
    async (kind) => {
      const onEdit = jest.fn();
      const view = await render(
        <AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}>
          <ItemDetailActions id={`${kind}-planning`} kind={kind} onEdit={onEdit} />
        </AppServicesProvider>,
      );

      await fireEvent.press(view.getByRole('button', { name: 'Запланировать' }));

      expect(onEdit).toHaveBeenCalledTimes(1);
      expect(view.queryByText(/следующем этапе планирования/)).toBeNull();
    },
  );

  test('completes a task with its subtask and deletes only after confirmation', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'task-1',
      title: 'Подготовить документы',
      createdAt: '2026-08-02T09:00:00.000Z',
    });
    const subtask = await createSubtask(source, {
      id: 'subtask-1',
      parentTaskId: task.id,
      title: 'Проверить паспорт',
      createdAt: '2026-08-02T09:01:00.000Z',
    });
    const deniedConfirmation = jest.fn(async () => false);
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <ItemDetailActions
          confirmDelete={deniedConfirmation}
          id={task.id}
          kind="task"
        />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByText('Завершить')).toBeTruthy();
    });

    await fireEvent.press(view.getByText('Завершить'));
    await waitFor(async () => {
      await expect(source.getTaskItem(task.id)).resolves.toMatchObject({
        completedAt: expect.any(String),
      });
      await expect(source.getTaskItem(subtask.id)).resolves.toMatchObject({
        completedAt: expect.any(String),
      });
    });

    await fireEvent.press(view.getByText('Удалить'));
    await waitFor(() => {
      expect(deniedConfirmation).toHaveBeenCalledTimes(1);
    });
    await expect(source.getTaskItem(task.id)).resolves.not.toBeNull();
  });

  test('deletes an item after a positive confirmation', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'task-1',
      title: 'Удалить после подтверждения',
      createdAt: '2026-08-02T09:00:00.000Z',
    });
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <ItemDetailActions confirmDelete={async () => true} id={task.id} kind="task" />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByText('Удалить')).toBeTruthy();
    });
    await fireEvent.press(view.getByText('Удалить'));

    await waitFor(async () => {
      await expect(source.getTaskItem(task.id)).resolves.toBeNull();
    });
  });
});
