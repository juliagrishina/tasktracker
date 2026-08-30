import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { PlanningDatePicker } from '../../src/ui/backlog/planning-date-picker';

describe('PlanningDatePicker', () => {
  test('marks today when the picker opens on a different selected date', async () => {
    const view = await render(<PlanningDatePicker accessibilityLabel="Дата задачи" onChange={() => {}} todayDate="2026-08-07" value="2026-08-05" />);

    fireEvent.press(view.getByLabelText('Дата задачи'));

    await waitFor(() => expect(view.getByLabelText('7 Август 2026, сегодня')).toBeOnTheScreen());
    expect(view.getByLabelText('5 Август 2026')).toBeOnTheScreen();
  });
});
