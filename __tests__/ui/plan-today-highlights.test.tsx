import { render } from '@testing-library/react-native';

import { MonthLoadGrid } from '../../src/ui/plan/month-load-grid';
import { getMonthLoadDays, getWeekLoadDays } from '../../src/ui/plan/plan-period-model';
import { WeekLoadList } from '../../src/ui/plan/week-load-list';
import { designTokens } from '../../src/ui/design/tokens';

describe('plan today highlights', () => {
  test('marks today independently from the selected date in the weekly plan', async () => {
    const view = await render(<WeekLoadList days={getWeekLoadDays('2026-08-05')} onSelectDate={() => {}} selectedDate="2026-08-05" todayDate="2026-08-07" />);

    expect(view.getByLabelText('Пятница, 7 августа: загрузка 0%, сегодня')).toBeOnTheScreen();
    expect(view.getByLabelText('Среда, 5 августа: загрузка 0%')).toBeOnTheScreen();
  });

  test('marks today independently from the selected date in the monthly plan', async () => {
    const view = await render(<MonthLoadGrid onSelectDate={() => {}} selectedDate="2026-08-05" todayDate="2026-08-07" weeks={getMonthLoadDays('2026-08-05')} />);

    expect(view.getByLabelText('7 августа: загрузка 0%, сегодня')).toBeOnTheScreen();
    expect(view.getByLabelText('5 августа: загрузка 0%')).toBeOnTheScreen();
    expect(view.getByText('7')).toHaveStyle({ color: designTokens.color.text.inverse });
  });
});
