import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CompletedHistoryScreen } from '../../src/ui/completed/completed-history-screen';

describe('CompletedHistoryScreen', () => {
  test('renders the approved Completed 1 archive hierarchy', async () => {
    const view = await render(<CompletedHistoryScreen />);

    expect(view.getByPlaceholderText('Поиск по названию')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Неделя' }).props.accessibilityState.selected).toBe(true);
    expect(view.getAllByText('Сегодня')).toHaveLength(2);
    expect(view.getByText('Вчера · 2 августа')).toBeOnTheScreen();
    expect(
      view.getByText('Удалить окончательно доступно только с подтверждением.'),
    ).toBeOnTheScreen();
  });

  test('filters the local demo archive by the entered title', async () => {
    const view = await render(<CompletedHistoryScreen />);

    fireEvent.changeText(view.getByPlaceholderText('Поиск по названию'), 'обратную');

    await waitFor(() => {
      expect(view.getByText('Собрать обратную связь')).toBeOnTheScreen();
      expect(view.queryByText('Согласовать структуру')).toBeNull();
    });
  });
});
