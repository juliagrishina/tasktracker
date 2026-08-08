import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { getDefaultSettings } from '../../src/data/default-settings';
import { SettingsStatePanel } from '../../src/ui/settings/settings-state-panel';

describe('SettingsStatePanel', () => {
  test('renders the approved Settings 2 state cards', async () => {
    const view = await render(<SettingsStatePanel settings={getDefaultSettings()} />);

    expect(view.getByText('Microsoft 365')).toBeOnTheScreen();
    expect(view.getByText('Подключён')).toBeOnTheScreen();
    expect(view.getByText('Рабочий диапазон')).toBeOnTheScreen();
    expect(view.getByText('Уведомления')).toBeOnTheScreen();
    expect(view.getByText('Удалить локальные данные')).toBeOnTheScreen();
    expect(view.getByText(/Версия 1\.0\.0/)).toBeOnTheScreen();
  });

  test('keeps the Microsoft 365 refresh action inside local demo state', async () => {
    const view = await render(<SettingsStatePanel settings={getDefaultSettings()} />);

    fireEvent.press(view.getByRole('button', { name: 'Обновить сейчас' }));

    await waitFor(() => {
      expect(view.getByText('Статус обновлён в демо-режиме')).toBeOnTheScreen();
    });
  });
});
