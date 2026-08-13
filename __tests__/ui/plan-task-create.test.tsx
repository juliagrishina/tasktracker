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
      timeZoneId: null,
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
    await fireEvent.changeText(view.getByLabelText('Название'), 'Отчёт только за февраль');
    await fireEvent.press(view.getByText('Только этот экземпляр'));
    await fireEvent.press(view.getByText('Создать'));

    await expect(source.getRecurrenceOccurrence('occurrence-february')).resolves.toMatchObject({
      occursOn: '2028-02-29',
      seriesId: series.id,
      taskPatch: expect.objectContaining({ title: 'Отчёт только за февраль' }),
    });
    await expect(source.getTaskItem(task.id)).resolves.toMatchObject({
      title: task.title,
    });
    await expect(source.getRecurrenceSeries(series.id)).resolves.toEqual(series);
  });

  test('opens the instance scope chooser from a recurring block in Plan', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'plan-recurring-task',
      title: 'Плановая сверка',
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    await source.saveScheduleBlock({
      id: 'plan-recurring-source-block',
      taskItemId: task.id,
      occurrenceId: null,
      startsAt: '2026-08-05T09:00:00+03:00',
      endsAt: '2026-08-05T10:00:00+03:00',
      timeZoneId: null,
      createdAt: task.createdAt,
    });
    await source.saveRecurrenceSeries({
      id: 'plan-recurring-series',
      itemKind: 'task',
      itemId: task.id,
      frequency: 'weekly',
      interval: 1,
      startsOn: '2026-08-05',
      createdAt: task.createdAt,
    });
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <PlanScreen initialDate="2026-08-12" />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Редактировать Плановая сверка')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Редактировать Плановая сверка'));

    await waitFor(() => {
      expect(view.getByText('Только этот экземпляр')).toBeOnTheScreen();
      expect(view.getByText('Всю серию')).toBeOnTheScreen();
    });
  });

  test('edits the full source interval when a Plan block continues from the previous day', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'overnight-edit-task',
      title: 'Ночная сверка',
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    await source.saveScheduleBlock({
      id: 'overnight-edit-block',
      taskItemId: task.id,
      occurrenceId: null,
      startsAt: '2026-08-05T23:30:00+03:00',
      endsAt: '2026-08-06T00:30:00+03:00',
      timeZoneId: null,
      createdAt: task.createdAt,
    });
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <PlanScreen initialDate="2026-08-06" />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Редактировать Ночная сверка')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Редактировать Ночная сверка'));

    await waitFor(() => {
      expect(view.getByLabelText('Дата блока 1').props.value).toBe('2026-08-05');
      expect(view.getByLabelText('Начало блока 1').props.value).toBe('23:30');
      expect(view.getByLabelText('Длительность блока 1').props.value).toBe('60');
    });
    await fireEvent.press(view.getByText('Создать'));

    await waitFor(async () => {
      await expect(source.getScheduleBlock('overnight-edit-block')).resolves.toMatchObject({
        startsAt: '2026-08-05T23:30:00+03:00',
        endsAt: '2026-08-06T00:30:00+03:00',
      });
    });
  });

  test('switches to the complete master schedule before saving a recurring series', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'series-edit-task',
      title: 'РЎРµСЂРёСЏ РґР»СЏ РёР·РјРµРЅРµРЅРёСЏ',
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    const series = {
      id: 'series-edit-series',
      itemKind: 'task' as const,
      itemId: task.id,
      frequency: 'weekly' as const,
      interval: 1,
      startsOn: '2026-08-05',
      createdAt: task.createdAt,
    };
    const masterBlocks = [
      {
        id: 'series-master-one', taskItemId: task.id, occurrenceId: null,
        startsAt: '2026-08-05T09:00:00+03:00', endsAt: '2026-08-05T10:00:00+03:00', timeZoneId: null, createdAt: task.createdAt,
      },
      {
        id: 'series-master-two', taskItemId: task.id, occurrenceId: null,
        startsAt: '2026-08-05T13:00:00+03:00', endsAt: '2026-08-05T14:00:00+03:00', timeZoneId: null, createdAt: task.createdAt,
      },
    ];
    await source.saveRecurrenceSeries(series);
    await Promise.all(masterBlocks.map((entry) => source.saveScheduleBlock(entry)));
    const seriesDraft = {
      blocks: masterBlocks.map((entry) => ({
        id: entry.id,
        date: '2026-08-05',
        startsAt: entry.startsAt.slice(11, 16),
        durationMinutes: '60',
      })),
      periodEndOn: '', periodStartOn: '', repeatFrequency: 'weekly' as const,
      repeatInterval: '1', scheduledOn: '', scheduleMode: 'none' as const,
    };
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <ItemFormSheet
          item={task}
          mode="edit"
          onClose={jest.fn()}
          planningContext={{
            defaultDate: '2026-08-12',
            initialBlockIds: ['recurrence-series-edit-series-2026-08-12-series-master-one'],
            initialDraft: {
              ...seriesDraft,
              blocks: [{
                id: 'recurrence-series-edit-series-2026-08-12-series-master-one',
                date: '2026-08-12', startsAt: '09:00', durationMinutes: '60',
              }],
            },
            seriesInitialBlockIds: masterBlocks.map((entry) => entry.id),
            seriesDraft,
            occurrence: { id: 'series-edit-occurrence', occursOn: '2026-08-12', seriesId: series.id },
          }}
          type="task"
          visible
        />
      </AppServicesProvider>,
    );

    await fireEvent.press(view.getByText('\u0412\u0441\u044e \u0441\u0435\u0440\u0438\u044e'));
    await waitFor(() => {
      expect(view.getByLabelText('\u041d\u0430\u0447\u0430\u043b\u043e \u0431\u043b\u043e\u043a\u0430 2')).toBeOnTheScreen();
    });
    await fireEvent.changeText(view.getByLabelText('\u041d\u0430\u0447\u0430\u043b\u043e \u0431\u043b\u043e\u043a\u0430 1'), '08:00');
    await fireEvent.press(view.getByLabelText('\u041d\u0435\u0442'));
    await fireEvent.press(view.getByText('\u0421\u043e\u0437\u0434\u0430\u0442\u044c'));

    await waitFor(async () => {
      await expect(source.listScheduleBlocks()).resolves.toEqual([
        expect.objectContaining({ id: 'series-master-one', startsAt: '2026-08-05T08:00:00+03:00' }),
        expect.objectContaining({ id: 'series-master-two' }),
      ]);
    });
    await expect(source.getRecurrenceSeries(series.id)).resolves.toBeNull();
  });

  test('cancels a supplied recurring instance without changing the series', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'cancel-instance-task',
      title: 'РЎРІРµСЂРєР° РґР»СЏ РѕС‚РјРµРЅС‹',
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    const series = {
      id: 'cancel-instance-series',
      itemKind: 'task' as const,
      itemId: task.id,
      frequency: 'weekly' as const,
      interval: 1,
      startsOn: '2026-08-05',
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
            defaultDate: '2026-08-12',
            occurrence: {
              id: 'cancel-instance-occurrence',
              occursOn: '2026-08-12',
              seriesId: series.id,
            },
          }}
          type="task"
          visible
        />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u044d\u0442\u043e\u0442 \u044d\u043a\u0437\u0435\u043c\u043f\u043b\u044f\u0440')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u044d\u0442\u043e\u0442 \u044d\u043a\u0437\u0435\u043c\u043f\u043b\u044f\u0440'));

    await expect(source.getRecurrenceOccurrence('cancel-instance-occurrence')).resolves.toMatchObject({
      status: 'cancelled',
    });
    await expect(source.getRecurrenceSeries(series.id)).resolves.toEqual(series);
  });
});
