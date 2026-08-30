import { fireEvent, render } from '@testing-library/react-native';
import { PlanningSuccess } from '../../src/ui/backlog/planning-success';

test('shows the planned item and navigates to its actual date', async () => {
  const onGoToPlan = jest.fn();
  const view = await render(<PlanningSuccess onGoToPlan={onGoToPlan} result={{ type: 'subtask', title: 'Подготовить повестку', plannedOn: '2026-09-03' }} />);
  expect(view.getByText('Подзадача успешно запланирована')).toBeOnTheScreen();
  expect(view.getByText('Подготовить повестку')).toBeOnTheScreen();
  expect(view.getByText('Перейти к дате 03.09.2026?')).toBeOnTheScreen();
  fireEvent.press(view.getByLabelText('Перейти к запланированной дате'));
  expect(onGoToPlan).toHaveBeenCalledTimes(1);
});
