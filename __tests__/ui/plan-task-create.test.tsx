import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createTask } from '../../src/application/backlog-use-cases';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { ItemFormSheet } from '../../src/ui/backlog/item-form-sheet';
import { PlanScreen } from '../../src/ui/plan/plan-screen';

describe('Plan task creation sheet', () => {
  test('opens the approved planning states from the Plan FAB', async () => {
    const view = await render(
      <AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}>
        <PlanScreen />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Добавить в план')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Добавить в план'));

    await waitFor(() => {
      expect(view.getByText('Новая задача')).toBeOnTheScreen();
      expect(view.getByText('Без даты')).toBeOnTheScreen();
      expect(view.getByText('Повторение')).toBeOnTheScreen();
    });

    await fireEvent.press(view.getByText('Период'));
    await waitFor(() => {
      expect(view.getByLabelText('Начало периода задачи')).toBeOnTheScreen();
      expect(view.getByLabelText('Конец периода задачи')).toBeOnTheScreen();
    });

    await fireEvent.press(view.getByText('Каждую неделю'));
    await waitFor(() => {
      expect(view.getByLabelText('Интервал повторения')).toBeOnTheScreen();
    });

    await fireEvent.press(view.getByText('Добавить блок времени'));
    await waitFor(() => {
      expect(view.getByLabelText('Начало блока 1')).toBeOnTheScreen();
      expect(view.getByLabelText('Длительность блока 1')).toBeOnTheScreen();
    });
  });

  test('persists the Plan task date and time block', async () => {
    const source = createInMemoryDataSource();
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <PlanScreen />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Добавить в план')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Добавить в план'));
    await waitFor(() => {
      expect(view.getByLabelText('Название')).toBeOnTheScreen();
    });
    await fireEvent.changeText(view.getByLabelText('Название'), 'Подготовить план релиза');
    await fireEvent.press(view.getByText('Дата'));
    await waitFor(() => {
      expect(view.getByLabelText('Дата задачи')).toBeOnTheScreen();
    });
    await fireEvent.changeText(view.getByLabelText('Дата задачи'), '2026-08-05');
    await waitFor(() => {
      expect(view.getByLabelText('Дата задачи').props.value).toBe('2026-08-05');
    });
    await fireEvent.press(view.getByText('Добавить блок времени'));
    await waitFor(() => {
      expect(view.getByLabelText('Дата блока 1')).toBeOnTheScreen();
    });
    await fireEvent.changeText(view.getByLabelText('Дата блока 1'), '2026-08-05');
    await fireEvent.changeText(view.getByLabelText('Начало блока 1'), '09:00');
    await fireEvent.changeText(view.getByLabelText('Длительность блока 1'), '30');
    await fireEvent.press(view.getByText('Создать'));

    await waitFor(async () => {
      expect((await source.listTaskItems()).map((task) => task.title)).toContain('Подготовить план релиза');
    });
    await expect(source.listScheduleBlocks()).resolves.toHaveLength(1);
    await expect(source.listTaskItems()).resolves.toContainEqual(
      expect.objectContaining({ scheduledOn: '2026-08-05' }),
    );
  });

  test('keeps a conflicting block unsaved until the user confirms it', async () => {
    const source = createInMemoryDataSource();
    const existingTask = await createTask(source, {
      id: 'existing-task',
      title: 'Занятый интервал',
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    await source.saveScheduleBlock({
      id: 'existing-block',
      taskItemId: existingTask.id,
      occurrenceId: null,
      startsAt: '2026-08-05T06:00:00.000Z',
      endsAt: '2026-08-05T07:00:00.000Z',
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <PlanScreen />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Добавить в план')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Добавить в план'));
    await waitFor(() => {
      expect(view.getByLabelText('Название')).toBeOnTheScreen();
    });
    await fireEvent.changeText(view.getByLabelText('Название'), 'Новый блок');
    await fireEvent.press(view.getByText('Добавить блок времени'));
    await waitFor(() => {
      expect(view.getByLabelText('Дата блока 1')).toBeOnTheScreen();
    });
    await fireEvent.changeText(view.getByLabelText('Дата блока 1'), '2026-08-05');
    await fireEvent.changeText(view.getByLabelText('Начало блока 1'), '09:30');
    await fireEvent.changeText(view.getByLabelText('Длительность блока 1'), '30');
    await fireEvent.press(view.getByText('Создать'));

    await waitFor(() => {
      expect(view.getByText('Пересечение в расписании')).toBeOnTheScreen();
    });
    expect(await source.listScheduleBlocks()).toHaveLength(1);

    await fireEvent.press(view.getByText('Сохранить с пересечением'));
    await waitFor(async () => {
      expect(await source.listScheduleBlocks()).toHaveLength(2);
    });
  });

  test('changes only a supplied recurring occurrence when the user selects its scope', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'recurring-task',
      title: 'Ежемесячный отчёт',
      createdAt: '2028-01-31T08:00:00.000Z',
    });
    const series = {
      id: 'monthly-series',
      itemKind: 'task' as const,
      itemId: task.id,
      frequency: 'monthly' as const,
      interval: 1,
      startsOn: '2028-01-31',
      createdAt: task.createdAt,
    };
    await source.saveRecurrenceSeries(series);
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <ItemFormSheet
          item={task}
          mode="edit"
          onClose={jest.fn()}
          planningContext={{
            defaultDate: '2028-02-29',
            occurrence: {
              id: 'occurrence-february',
              occursOn: '2028-02-29',
              seriesId: series.id,
            },
          }}
          type="task"
          visible
        />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByText('Только этот экземпляр')).toBeOnTheScreen();
      expect(view.getByText('Всю серию')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByText('Только этот экземпляр'));
    await fireEvent.press(view.getByText('Создать'));

    await expect(source.getRecurrenceOccurrence('occurrence-february')).resolves.toMatchObject({
      occursOn: '2028-02-29',
      seriesId: series.id,
    });
    await expect(source.getRecurrenceSeries(series.id)).resolves.toEqual(series);
  });
});
