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
