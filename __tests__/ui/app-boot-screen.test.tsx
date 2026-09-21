import { render } from '@testing-library/react-native';

import { AppBootScreen } from '../../src/ui/primitives/app-boot-screen';

describe('AppBootScreen', () => {
  test('shows a determinate local-workspace loading stage', async () => {
    const view = await render(<AppBootScreen message="Открываем локальную копию" progress={45} />);

    expect(view.getByLabelText('Прогресс запуска')).toHaveAccessibilityValue({ min: 0, max: 100, now: 45 });
    expect(view.getByText('45%')).toBeOnTheScreen();
    expect(view.getByLabelText('Логотип Plan My Plan')).toBeOnTheScreen();
  });
});
