import { render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { ActionButton } from '../../src/ui/primitives/action-button';
import { ScreenShell } from '../../src/ui/screen-shell';

describe('ScreenShell', () => {
  test('renders a title and keeps the back action touch target at least 44 points', async () => {
    const view = await render(
      <ScreenShell
        headerAction={<ActionButton label="Добавить" onPress={jest.fn()} tone="soft" />}
        onBack={jest.fn()}
        title="Backlog">
        <Text>Контент</Text>
      </ScreenShell>,
    );

    expect(view.getByText('Backlog')).toBeOnTheScreen();
    expect(view.getByLabelText('Добавить')).toBeOnTheScreen();
    expect(StyleSheet.flatten(view.getByLabelText('Назад').props.style).minHeight).toBe(44);
  });
});
