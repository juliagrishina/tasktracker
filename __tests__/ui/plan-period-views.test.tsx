import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { createTask } from '../../src/application/backlog-use-cases';
import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { PlanScreen } from '../../src/ui/plan/plan-screen';

const selectedDate = '2026-08-05';

async function renderPlan() {
  const source = createInMemoryDataSource();
  const view = await render(
    <AppServicesProvider seedDevelopmentData={false} source={source}>
      <PlanScreen initialDate={selectedDate} />
    </AppServicesProvider>,
  );

  return { source, view };
}

async function openModeMenu(view: Awaited<ReturnType<typeof render>>) {
  await fireEvent.press(view.getByLabelText('Режим просмотра: День'));
  await waitFor(() => {
    expect(view.getByRole('button', { name: 'День' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Неделя' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Месяц' })).toBeOnTheScreen();
  });
}

describe('PlanScreen view mode control', () => {
  test('switches from Day to Week through the approved three-option menu', async () => {
    const { view } = await renderPlan();

    await openModeMenu(view);
    await fireEvent.press(view.getByLabelText('Неделя'));

    await waitFor(() => {
      expect(view.getByLabelText('Режим просмотра: Неделя')).toBeOnTheScreen();
    });
  });

  test('switches to Month without adding another view mode', async () => {
    const { view } = await renderPlan();

    await openModeMenu(view);
    await fireEvent.press(view.getByLabelText('Месяц'));

    await waitFor(() => {
      expect(view.getByLabelText('Режим просмотра: Месяц')).toBeOnTheScreen();
      expect(view.getAllByText('Август 2026')).toHaveLength(2);
    });
    expect(view.queryByRole('button', { name: 'Год' })).toBeNull();
  });
});

describe('PlanScreen period views', () => {
  test('shows a persisted block load in Week and opens that date in Day', async () => {
    const { source, view } = await renderPlan();
    const task = await createTask(source, {
      id: 'persisted-load-task',
      title: 'Подготовить релиз',
      createdAt: '2026-08-01T08:00:00.000Z',
    });
    await source.saveScheduleBlock({
      id: 'persisted-fifteen-hour-block',
      taskItemId: task.id,
      occurrenceId: null,
      startsAt: '2026-08-05T07:00:00+03:00',
      endsAt: '2026-08-05T22:00:00+03:00',
      createdAt: task.createdAt,
    });

    await openModeMenu(view);
    await fireEvent.press(view.getByLabelText('Неделя'));

    const dayLabel = 'Среда, 5 августа: загрузка 107.14285714285714%';
    await waitFor(() => {
      expect(view.getAllByText('3–9 августа')).toHaveLength(2);
      expect(view.getAllByLabelText(/загрузка/)).toHaveLength(7);
      expect(view.getByLabelText(dayLabel)).toBeOnTheScreen();
    });

    await fireEvent.press(view.getByLabelText(dayLabel));
    await waitFor(() => {
      expect(view.getByLabelText('Режим просмотра: День')).toBeOnTheScreen();
      expect(view.getAllByText('Подготовить релиз')).toHaveLength(2);
    });
  });

  test('moves the month heatmap to the next month', async () => {
    const { view } = await renderPlan();

    await openModeMenu(view);
    await fireEvent.press(view.getByLabelText('Месяц'));

    await waitFor(() => {
      expect(view.getAllByText('Август 2026')).toHaveLength(2);
      expect(view.getByLabelText('5 августа: загрузка 0%')).toBeOnTheScreen();
    });

    await fireEvent.press(view.getByLabelText('Следующий месяц'));
    await waitFor(() => {
      expect(view.getAllByText('Сентябрь 2026')).toHaveLength(2);
    });
  });
});
