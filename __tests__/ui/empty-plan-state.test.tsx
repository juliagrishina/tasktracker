import { render } from '@testing-library/react-native';

import { EmptyPlanState } from '../../src/ui/empty-plan-state';

describe('EmptyPlanState', () => {
  test('explains where the first task will appear', async () => {
    const view = await render(
      <EmptyPlanState today={new Date('2026-08-01T09:00:00.000Z')} />,
    );

    expect(view.getByText('План на сегодня')).toBeOnTheScreen();
    expect(
      view.getByText('Первое дело появится в Backlog'),
    ).toBeOnTheScreen();
  });
});
