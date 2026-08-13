import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createProject, createTask } from '../../src/application/backlog-use-cases';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { BacklogRootScreen } from '../../src/ui/backlog/backlog-root-screen';
import { ItemFormSheet } from '../../src/ui/backlog/item-form-sheet';

describe('Backlog item form', () => {
  test('keeps the form open and displays validation when saving a blank title', async () => {
    const view = await render(
      <AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}>
        <BacklogRootScreen />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Добавить элемент')).toBeOnTheScreen();
    });

    fireEvent.press(view.getByLabelText('Добавить элемент'));
    await waitFor(() => {
      expect(view.getByText('Новая задача')).toBeTruthy();
    });
    fireEvent.press(view.getByText('Новая задача'));
    await waitFor(() => {
      expect(view.getByText('Сохранить')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(view.getByText('Сохранить'));
    });

    await waitFor(() => {
      expect(view.getByText('Название обязательно')).toBeTruthy();
    });
    expect(view.getByLabelText('Название')).toBeTruthy();
  });

  test('persists reminder planning and its recurrence series', async () => {
    const source = createInMemoryDataSource();
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <BacklogRootScreen />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Добавить элемент')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Добавить элемент'));
    await waitFor(() => {
      expect(view.getByText('Новое напоминание')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByText('Новое напоминание'));
    await waitFor(() => {
      expect(view.getByLabelText('Название')).toBeOnTheScreen();
    });
    await fireEvent.changeText(view.getByLabelText('Название'), 'Оплатить страховку');
    await fireEvent.changeText(view.getByLabelText('Дата'), '2026-08-10');
    await fireEvent.press(view.getByText('Каждый день'));
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(async () => {
      expect((await source.listReminders()).map((reminder) => reminder.title)).toContain(
        'Оплатить страховку',
      );
    });
    await expect(source.listRecurrenceSeries()).resolves.toContainEqual(
      expect.objectContaining({ itemKind: 'reminder', frequency: 'daily' }),
    );
  });

  test('converts a timed reminder into a task only after confirmation', async () => {
    const source = createInMemoryDataSource();
    await createProject(source, {
      id: 'project-reminder',
      title: 'Работа',
      createdAt: '2026-08-10T08:00:00.000Z',
    });
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <ItemFormSheet mode="create" onClose={jest.fn()} type="reminder" visible />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Название')).toBeOnTheScreen();
    });
    await fireEvent.changeText(view.getByLabelText('Название'), 'Позвонить клиенту');
    await fireEvent.changeText(view.getByLabelText('Дата'), '2026-08-10');
    await fireEvent.changeText(view.getByLabelText('Оценочная длительность, мин.'), '30');
    await fireEvent.press(view.getByText('Добавить время'));
    await waitFor(() => {
      expect(view.getByLabelText('Дата блока напоминания')).toBeOnTheScreen();
      expect(view.getByLabelText('Время блока напоминания')).toBeOnTheScreen();
    });
    await fireEvent.changeText(view.getByLabelText('Дата блока напоминания'), '2026-08-10');
    await fireEvent.changeText(view.getByLabelText('Время блока напоминания'), '09:00');
    await fireEvent.press(view.getByLabelText('Выбрать проект'));
    await fireEvent.press(view.getByText('Работа'));
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(() => {
      expect(view.getByText('Преобразовать напоминание в задачу?')).toBeOnTheScreen();
    });
    await expect(source.listReminders()).resolves.toHaveLength(1);
    await expect(source.listTaskItems()).resolves.toHaveLength(0);

    await fireEvent.press(view.getByText('Преобразовать'));
    await waitFor(async () => {
      expect(await source.listReminders()).toHaveLength(0);
    });
    await expect(source.listTaskItems()).resolves.toContainEqual(
      expect.objectContaining({ projectId: 'project-reminder', title: 'Позвонить клиенту' }),
    );
    await expect(source.listScheduleBlocks()).resolves.toHaveLength(1);
  });

  test('saves an independently planned subtask with its own time block', async () => {
    const source = createInMemoryDataSource();
    const parent = await createTask(source, {
      id: 'subtask-parent',
      title: 'Родительская задача',
      createdAt: '2026-08-10T08:00:00.000Z',
    });
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <ItemFormSheet
          mode="create"
          onClose={jest.fn()}
          parentTaskId={parent.id}
          planningContext={{ defaultDate: '2026-08-10' }}
          type="subtask"
          visible
        />
      </AppServicesProvider>,
    );

    await fireEvent.changeText(view.getByLabelText('Название'), 'Проверить данные');
    await fireEvent.press(view.getByText('Добавить блок времени'));
    await fireEvent.changeText(view.getByLabelText('Дата блока 1'), '2026-08-10');
    await fireEvent.changeText(view.getByLabelText('Начало блока 1'), '09:00');
    await fireEvent.changeText(view.getByLabelText('Длительность блока 1'), '30');
    await fireEvent.press(view.getByText('Создать'));

    await waitFor(async () => {
      expect(await source.listScheduleBlocks()).toHaveLength(1);
    });
    await expect(source.listTaskItems()).resolves.toContainEqual(
      expect.objectContaining({ kind: 'subtask', scheduledOn: null, title: 'Проверить данные' }),
    );
  });
});
