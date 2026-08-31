import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ActionButton } from '../../src/ui/primitives/action-button';
import { StatusPill } from '../../src/ui/primitives/status-pill';
import { SurfaceCard } from '../../src/ui/primitives/surface-card';

describe('UI primitives', () => {
  test('exposes an interactive surface card as a labelled button', async () => {
    const onPress = jest.fn();
    const view = await render(
      <SurfaceCard accessibilityLabel="Напоминания" onPress={onPress}>
        <Text>Содержимое</Text>
      </SurfaceCard>,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Напоминания' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('marks a disabled destructive action as disabled', async () => {
    const view = await render(
      <ActionButton disabled label="Удалить" onPress={jest.fn()} tone="danger" />,
    );

    expect(view.getByRole('button', { name: 'Удалить' }).props.accessibilityState.disabled).toBe(true);
  });

  test('renders the status label for assistive technologies', async () => {
    const view = await render(<StatusPill label="Подключено" tone="success" />);

    expect(view.getByText('Подключено')).toBeOnTheScreen();
  });
});
