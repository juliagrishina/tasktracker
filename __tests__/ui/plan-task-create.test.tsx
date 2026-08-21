import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
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
    fireEvent.press(view.getByLabelText('Добавить в план'));

    await waitFor(() => {
      expect(view.getByText('Новая задача')).toBeOnTheScreen();
      expect(view.getByText('Без даты')).toBeOnTheScreen();
      expect(view.getByText('Повторение')).toBeOnTheScreen();
    });

    fireEvent.press(view.getByText('Период'));
    await waitFor(() => {
      expect(view.getByLabelText('Начало периода задачи')).toBeOnTheScreen();
      expect(view.getByLabelText('Конец периода задачи')).toBeOnTheScreen();
    });

    fireEvent.press(view.getByText('Каждую неделю'));
    await waitFor(() => {
      expect(view.getByLabelText('Интервал повторения')).toBeOnTheScreen();
    });

    fireEvent.press(view.getByText('Добавить блок времени'));
    await waitFor(() => {
      expect(view.getByLabelText('Начало блока 1')).toBeOnTheScreen();
      expect(view.getByLabelText('Длительность блока 1')).toBeOnTheScreen();
    });
  });

  test('persists a planned block together with the new task', async () => {
    const source = createInMemoryDataSource();
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <PlanScreen />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Добавить в план')).toBeOnTheScreen();
    });
    fireEvent.press(view.getByLabelText('Добавить в план'));
    await waitFor(() => {
      expect(view.getByLabelText('Название')).toBeOnTheScreen();
    });
    fireEvent.changeText(view.getByLabelText('Название'), 'Подготовить план релиза');
    await waitFor(() => {
      expect(view.getByLabelText('Название').props.value).toBe('Подготовить план релиза');
    });
    fireEvent.press(view.getByLabelText('Добавить блок времени'));
    await waitFor(() => {
      expect(view.getByLabelText('Начало блока 1')).toBeOnTheScreen();
    });
    fireEvent.press(view.getByText('Создать'));

    await waitFor(async () => {
      expect((await source.listTaskItems()).map((task) => task.title)).toContain('Подготовить план релиза');
    });
    await waitFor(async () => {
      expect(await source.listScheduleBlocks()).toHaveLength(1);
    });
  });
});
