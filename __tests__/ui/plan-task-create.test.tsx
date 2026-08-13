import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createReminder, createTask } from '../../src/application/backlog-use-cases';
import { getDayPlan } from '../../src/application/plan-load-selector';
import { saveTaskPlanning } from '../../src/application/planning-use-cases';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { ItemFormSheet } from '../../src/ui/backlog/item-form-sheet';
import { PlanScreen } from '../../src/ui/plan/plan-screen';

type RenderedView = Awaited<ReturnType<typeof render>>;

async function choosePickerValue(view: RenderedView, triggerLabel: string, optionLabel: string) {
  await waitFor(() => {
    expect(view.getByLabelText(triggerLabel)).toBeOnTheScreen();
  });
  await fireEvent.press(view.getByLabelText(triggerLabel));
  await waitFor(() => {
    expect(view.getByLabelText(optionLabel)).toBeOnTheScreen();
  });
  await fireEvent.press(view.getByLabelText(optionLabel));
}

async function chooseSelectedPickerValue(view: RenderedView, triggerLabel: string) {
  await fireEvent.press(view.getByLabelText(triggerLabel));
  const selectedOption = await waitFor(() => {
    const option = view.getAllByRole('button').find((candidate) => (
      candidate.props.accessibilityState?.selected === true
      && /^\d{2}:\d{2}/.test(candidate.props.accessibilityLabel ?? '')
    ));
    expect(option).toBeDefined();
    return option;
  });
  await fireEvent.press(selectedOption!);
}

async function chooseCalendarDate(view: RenderedView, triggerLabel: string, dayLabel: string) {
  if (view.queryByLabelText(dayLabel) === null) {
    await fireEvent.press(view.getByLabelText(triggerLabel));
  }
  await waitFor(() => {
    expect(view.getByLabelText(dayLabel)).toBeOnTheScreen();
  });
  await fireEvent.press(view.getByLabelText(dayLabel));
  await waitFor(() => {
    expect(view.getByLabelText(triggerLabel).props.accessibilityState?.expanded).toBe(false);
  });
}

describe('Plan task creation sheet', () => {
  test('opens calendar and value picker planning controls from the Plan FAB', async () => {
    const view = await render(
      <AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}>
        <PlanScreen initialDate="2026-08-13" />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Добавить в план')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Добавить в план'));

    await waitFor(() => {
      expect(view.getByText('Новая задача')).toBeOnTheScreen();
      expect(view.getByRole('button', { name: 'Без даты' })).toBeOnTheScreen();
      expect(view.getByText('Повторение')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByRole('button', { name: 'Период' }));
    await waitFor(() => {
      expect(view.getByLabelText('Начало периода задачи')).toBeOnTheScreen();
      expect(view.getByLabelText('Конец периода задачи')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Добавить временной интервал'));
    await waitFor(() => {
      expect(view.getByLabelText('Начало интервала 1')).toBeOnTheScreen();
      expect(view.getByLabelText('Конец интервала 1')).toBeOnTheScreen();
    });
  });

  test('persists a picker-selected task date and exact interval', async () => {
    const source = createInMemoryDataSource();
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <PlanScreen initialDate="2026-08-05" />
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
    await fireEvent.press(view.getByRole('button', { name: 'Дата' }));
    await waitFor(() => {
      expect(view.getByLabelText('Дата задачи')).toBeOnTheScreen();
    });
    await chooseCalendarDate(view, 'Дата задачи', '5 августа 2026');
    await fireEvent.press(view.getByLabelText('Добавить временной интервал'));
    await chooseSelectedPickerValue(view, 'Начало интервала 1');
    await chooseSelectedPickerValue(view, 'Конец интервала 1');
    await fireEvent.press(view.getByText('Создать'));

    await waitFor(async () => {
      await expect(source.listTaskItems()).resolves.toContainEqual(
        expect.objectContaining({ title: 'Подготовить план релиза', scheduledOn: '2026-08-05' }),
      );
    });
    await expect(source.listScheduleBlocks()).resolves.toContainEqual(expect.objectContaining({
      startsAt: expect.stringContaining('2026-08-05T'),
    }));
  });

  test('keeps a date-only plan when it is opened and saved again', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'date-only-task',
      title: 'Задача на дату',
      estimatedDurationMinutes: 45,
      createdAt: '2026-08-15T08:00:00.000Z',
    });
    await saveTaskPlanning(source, {
      taskId: task.id,
      scheduledOn: '2026-08-15',
      blocks: [],
    });
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <PlanScreen initialDate="2026-08-15" />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Редактировать Задача на дату')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Редактировать Задача на дату'));

    await waitFor(() => {
      expect(view.getByText('15.08.2026')).toBeOnTheScreen();
      expect(view.getByText('Сохранить')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(async () => {
      await expect(source.getTaskItem(task.id)).resolves.toMatchObject({
        scheduledOn: '2026-08-15',
        estimatedDurationMinutes: 45,
      });
    });
  });

  test('hydrates an existing exact block and deletes it when the user removes the interval', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'remove-block-task',
      title: 'Убрать точное время',
      createdAt: '2026-08-15T08:00:00.000Z',
    });
    await source.saveScheduleBlock({
      id: 'remove-block',
      taskItemId: task.id,
      occurrenceId: null,
      startsAt: '2026-08-15T09:00:00+03:00',
      endsAt: '2026-08-15T10:00:00+03:00',
      timeZoneId: 'Europe/Moscow',
      createdAt: task.createdAt,
    });
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <PlanScreen initialDate="2026-08-15" />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Редактировать Убрать точное время')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Редактировать Убрать точное время'));
    await waitFor(() => {
      expect(view.getByText('09:00')).toBeOnTheScreen();
      expect(view.getByText('Сохранить')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Удалить интервал 1'));
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(async () => {
      await expect(source.getScheduleBlock('remove-block')).resolves.toBeNull();
    });
  });

  test('moves only one recurring task instance and marks its block state overridden', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'move-task-instance',
      title: 'Повторяющаяся задача',
      estimatedDurationMinutes: 30,
      createdAt: '2026-08-15T08:00:00.000Z',
    });
    await saveTaskPlanning(source, {
      taskId: task.id,
      scheduledOn: '2026-08-15',
      blocks: [],
      recurrence: {
        id: 'move-task-series',
        frequency: 'daily',
        interval: 1,
        startsOn: '2026-08-15',
        createdAt: task.createdAt,
      },
    });
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <PlanScreen initialDate="2026-08-15" />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Редактировать Повторяющаяся задача')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Редактировать Повторяющаяся задача'));
    await waitFor(() => {
      expect(view.getByText('Только этот экземпляр')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByText('Только этот экземпляр'));
    await chooseCalendarDate(view, 'Дата задачи', '16 августа 2026');
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(async () => {
      await expect(source.getRecurrenceOccurrence('occurrence-move-task-series-2026-08-15')).resolves.toMatchObject({
        status: 'active',
        blocksOverridden: true,
        taskPatch: expect.objectContaining({ scheduledOn: '2026-08-16' }),
      });
    });
    await expect(getDayPlan(source, '2026-08-15')).resolves.toMatchObject({ untimedTasks: [] });
    const movedTaskDay = await getDayPlan(source, '2026-08-16');
    expect(movedTaskDay.untimedTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Повторяющаяся задача' }),
    ]));
  });

  test('moves only one recurring reminder instance', async () => {
    const source = createInMemoryDataSource();
    const reminder = await createReminder(source, {
      id: 'move-reminder-instance',
      title: 'Повторяющееся напоминание',
      remindsOn: '2026-08-15',
      repeatRule: { frequency: 'daily', interval: 1 },
      estimatedDurationMinutes: 20,
      createdAt: '2026-08-15T08:00:00.000Z',
    });
    await source.saveRecurrenceSeries({
      id: 'move-reminder-series',
      itemKind: 'reminder',
      itemId: reminder.id,
      frequency: 'daily',
      interval: 1,
      startsOn: '2026-08-15',
      createdAt: reminder.createdAt,
    });
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <PlanScreen initialDate="2026-08-15" />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Редактировать Повторяющееся напоминание')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Редактировать Повторяющееся напоминание'));
    await fireEvent.press(view.getByText('Только этот экземпляр'));
    await chooseCalendarDate(view, 'Дата напоминания', '16 августа 2026');
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(async () => {
      await expect(source.getRecurrenceOccurrence('occurrence-move-reminder-series-2026-08-15')).resolves.toMatchObject({
        status: 'active',
        reminderPatch: expect.objectContaining({ remindsOn: '2026-08-16' }),
      });
    });
    await expect(getDayPlan(source, '2026-08-15')).resolves.toMatchObject({ untimedReminders: [] });
    const movedReminderDay = await getDayPlan(source, '2026-08-16');
    expect(movedReminderDay.untimedReminders).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Повторяющееся напоминание' }),
    ]));
  });

  test('completes only one recurring reminder instance with a valid completion instant', async () => {
    const source = createInMemoryDataSource();
    const reminder = await createReminder(source, {
      id: 'complete-reminder-instance',
      title: 'Отметить приём лекарства',
      remindsOn: '2026-08-15',
      repeatRule: { frequency: 'daily', interval: 1 },
      estimatedDurationMinutes: 5,
      createdAt: '2026-08-15T08:00:00.000Z',
    });
    await source.saveRecurrenceSeries({
      id: 'complete-reminder-series',
      itemKind: 'reminder',
      itemId: reminder.id,
      frequency: 'daily',
      interval: 1,
      startsOn: '2026-08-15',
      createdAt: reminder.createdAt,
    });
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <PlanScreen initialDate="2026-08-15" />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Редактировать Отметить приём лекарства')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Редактировать Отметить приём лекарства'));
    await fireEvent.press(view.getByLabelText('Завершить этот экземпляр'));

    await waitFor(async () => {
      const occurrence = await source.getRecurrenceOccurrence('occurrence-complete-reminder-series-2026-08-15');
      expect(occurrence).toMatchObject({ status: 'completed' });
      expect(occurrence?.completedAt).toEqual(expect.any(String));
      expect(Number.isNaN(Date.parse(occurrence?.completedAt ?? ''))).toBe(false);
    });
    await expect(getDayPlan(source, '2026-08-15')).resolves.toMatchObject({ untimedReminders: [] });
    await expect(getDayPlan(source, '2026-08-16')).resolves.toMatchObject({
      untimedReminders: [expect.objectContaining({ title: 'Отметить приём лекарства' })],
    });
  });

  test('applies edits to the whole recurring task series when that scope is selected', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'series-edit-task',
      title: 'Старая серия',
      createdAt: '2026-08-15T08:00:00.000Z',
    });
    await saveTaskPlanning(source, {
      taskId: task.id,
      scheduledOn: '2026-08-15',
      blocks: [],
      recurrence: {
        id: 'series-edit-series',
        frequency: 'weekly',
        interval: 1,
        startsOn: '2026-08-15',
        createdAt: task.createdAt,
      },
    });
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <PlanScreen initialDate="2026-08-15" />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Редактировать Старая серия')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Редактировать Старая серия'));
    await fireEvent.press(view.getByText('Всю серию'));
    await fireEvent.changeText(view.getByLabelText('Название'), 'Обновлённая серия');
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(async () => {
      await expect(source.getTaskItem(task.id)).resolves.toMatchObject({ title: 'Обновлённая серия' });
    });
    await expect(source.getRecurrenceSeries('series-edit-series')).resolves.toMatchObject({
      frequency: 'weekly',
      interval: 1,
    });
  });

  test('cancels a supplied recurring task instance without changing the series', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'cancel-instance-task',
      title: 'Проверка для отмены',
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

    await fireEvent.press(view.getByLabelText('Отменить этот экземпляр'));

    await waitFor(async () => {
      await expect(source.getRecurrenceOccurrence('cancel-instance-occurrence')).resolves.toMatchObject({
        status: 'cancelled',
      });
    });
    await expect(source.getRecurrenceSeries(series.id)).resolves.toEqual(series);
  });
});
