import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { PlanScreen } from '../../src/ui/plan/plan-screen';

describe('PlanScreen view mode control', () => {
  test('switches from Day to Week through the approved three-option menu', async () => {
    const view = await render(<PlanScreen />);

    fireEvent.press(view.getByLabelText('Режим просмотра: День'));

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'День' })).toBeOnTheScreen();
      expect(view.getByRole('button', { name: 'Неделя' })).toBeOnTheScreen();
      expect(view.getByRole('button', { name: 'Месяц' })).toBeOnTheScreen();
    });

    fireEvent.press(view.getByLabelText('Неделя'));

    await waitFor(() => {
      expect(view.getByLabelText('Режим просмотра: Неделя')).toBeOnTheScreen();
    });
  });

  test('switches to Month without adding another view mode', async () => {
    const view = await render(<PlanScreen />);

    fireEvent.press(view.getByLabelText('Режим просмотра: День'));
    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Месяц' })).toBeOnTheScreen();
    });
    fireEvent.press(view.getByLabelText('Месяц'));

    await waitFor(() => {
      expect(view.getByLabelText('Режим просмотра: Месяц')).toBeOnTheScreen();
    });
    expect(view.queryByRole('button', { name: 'Год' })).toBeNull();
  });
});

describe('PlanScreen period views', () => {
  test('renders Week A as seven load-only days and opens the selected date in Day', async () => {
    const view = await render(<PlanScreen />);

    fireEvent.press(view.getByLabelText('Режим просмотра: День'));
    await waitFor(() => {
      expect(view.getByLabelText('Неделя')).toBeOnTheScreen();
    });
    fireEvent.press(view.getByLabelText('Неделя'));

    await waitFor(() => {
      expect(view.getAllByText('3–9 августа')).toHaveLength(2);
      expect(view.getAllByLabelText(/загрузка/)).toHaveLength(7);
      expect(view.getByLabelText('Среда, 5 августа: загрузка 104%')).toBeOnTheScreen();
    });
    expect(view.queryByText('Собрать прототип')).toBeNull();

    fireEvent.press(view.getByLabelText('Следующая неделя'));
    await waitFor(() => {
      expect(view.getAllByText('10–16 августа')).toHaveLength(2);
    });

    fireEvent.press(view.getByLabelText('Предыдущая неделя'));
    await waitFor(() => {
      expect(view.getAllByText('3–9 августа')).toHaveLength(2);
    });

    fireEvent.press(view.getByLabelText('Среда, 5 августа: загрузка 104%'));
    await waitFor(() => {
      expect(view.getByLabelText('Режим просмотра: День')).toBeOnTheScreen();
    });
  });

  test('renders Month B as a load heatmap and moves to the next month', async () => {
    const view = await render(<PlanScreen />);

    fireEvent.press(view.getByLabelText('Режим просмотра: День'));
    await waitFor(() => {
      expect(view.getByLabelText('Месяц')).toBeOnTheScreen();
    });
    fireEvent.press(view.getByLabelText('Месяц'));

    await waitFor(() => {
      expect(view.getAllByText('Август 2026')).toHaveLength(2);
      expect(view.getByLabelText('5 августа: загрузка 104%')).toBeOnTheScreen();
    });
    expect(view.queryByText('Планёрка команды')).toBeNull();

    fireEvent.press(view.getByLabelText('Следующий месяц'));
    await waitFor(() => {
      expect(view.getAllByText('Сентябрь 2026')).toHaveLength(2);
    });
  });
});
