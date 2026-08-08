import { render } from '@testing-library/react-native';

import { DayDashboard } from '../../src/ui/plan/day-dashboard';
import { ProgressRing } from '../../src/ui/plan/progress-ring';

describe('ProgressRing', () => {
  test('announces the approved completion percentage to assistive technology', async () => {
    const view = await render(<ProgressRing label="35%" value={35} />);

    expect(view.getByLabelText('Выполнено 35%')).toBeOnTheScreen();
  });
});

describe('DayDashboard', () => {
  test('renders the approved Plan B hierarchy instead of the development task list', async () => {
    const view = await render(<DayDashboard />);

    expect(view.getByText('Сегодня')).toBeOnTheScreen();
    expect(view.getByText('План в норме')).toBeOnTheScreen();
    expect(view.getByText('Без времени')).toBeOnTheScreen();
    expect(view.getByText('Расписание')).toBeOnTheScreen();
    expect(view.getByText('Планёрка команды')).toBeOnTheScreen();
  });
});
