import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { createDefaultBlock, createInitialTaskPlanningDraft } from '../../src/ui/backlog/task-planning-fields';
import { PlanScreen } from '../../src/ui/plan/plan-screen';

describe('Plan task creation sheet', () => {
  test('uses the selected plan date for a new task without a time block', () => {
    expect(createInitialTaskPlanningDraft('2026-08-05')).toMatchObject({
      blocks: [],
      scheduleMode: 'date',
      scheduledOn: '2026-08-05',
    });
  });

  test('moves the default block date forward when five-minute rounding crosses midnight', () => {
    expect(createDefaultBlock('2026-08-03', new Date(2026, 7, 3, 23, 59))).toMatchObject({
      date: '2026-08-04',
      startsAt: '00:00',
      durationMinutes: '60',
    });
  });

  test('rounds a new block strictly into the future when the current minute is already on the grid', () => {
    expect(createDefaultBlock('2026-08-03', new Date(2026, 7, 3, 10, 0, 30))).toMatchObject({
      date: '2026-08-03',
      startsAt: '10:05',
      durationMinutes: '60',
    });
  });

  test('opens the approved planning states from the Plan FAB', async () => {
    const view = await render(
      <AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}>
        <PlanScreen initialDate="2026-08-05" />
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

  test('persists a planned block together with the new task', async () => {
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
    await waitFor(() => {
      expect(view.getByLabelText('Название').props.value).toBe('Подготовить план релиза');
    });
    await fireEvent.press(view.getByLabelText('Добавить блок времени'));
    await waitFor(() => {
      expect(view.getByLabelText('Начало блока 1')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByText('Создать'));

    await waitFor(async () => {
      expect((await source.listTaskItems()).map((task) => task.title)).toContain('Подготовить план релиза');
    });
    await waitFor(async () => {
      expect(await source.listScheduleBlocks()).toHaveLength(1);
    });
    await waitFor(() => {
      expect(view.getByText('7%')).toBeOnTheScreen();
    });
  });

  test('puts a new task without a time block into the selected plan day', async () => {
    const source = createInMemoryDataSource();
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false}><PlanScreen initialDate="2026-08-05" /></AppServicesProvider>);

    await waitFor(() => expect(view.getByLabelText('Добавить в план')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Добавить в план'));
    if (view.queryByLabelText('Пропустить оценку энергии') !== null) {
      await fireEvent.press(view.getByLabelText('Пропустить оценку энергии'));
    }
    await waitFor(() => expect(view.getByLabelText('Название')).toBeOnTheScreen());
    await fireEvent.changeText(view.getByLabelText('Название'), 'Задача выбранного дня');
    await waitFor(() => expect(view.getByLabelText('Название').props.value).toBe('Задача выбранного дня'));
    await fireEvent.press(view.getByText('Создать'));

    await waitFor(async () => {
      expect(await source.listTaskItems()).toEqual(expect.arrayContaining([
        expect.objectContaining({ title: 'Задача выбранного дня', scheduledOn: '2026-08-05' }),
      ]));
    });
  });
});
