import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { getDefaultSettings } from '../../src/data/default-settings';
import { SettingsStatePanel } from '../../src/ui/settings/settings-state-panel';

describe('SettingsStatePanel', () => {
  test('saves the selected IANA timezone for all plan cards', async () => {
    const onTimeZoneChange = jest.fn().mockResolvedValue(undefined);
    const view = await render(<SettingsStatePanel onTimeZoneChange={onTimeZoneChange} settings={getDefaultSettings()} />);

    fireEvent.press(view.getByLabelText('Часовой пояс'));
    await waitFor(() => expect(view.getByLabelText('Часовой пояс IANA')).toBeOnTheScreen());
    fireEvent.changeText(view.getByLabelText('Часовой пояс IANA'), 'Europe/Berlin');
    await waitFor(() => expect(view.getByLabelText('Часовой пояс IANA').props.value).toBe('Europe/Berlin'));
    fireEvent.press(view.getByRole('button', { name: 'Сохранить часовой пояс' }));

    await waitFor(() => expect(onTimeZoneChange).toHaveBeenCalledWith('Europe/Berlin'));
  });

  test('renders the approved Settings 2 state cards', async () => {
    const view = await render(<SettingsStatePanel settings={getDefaultSettings()} />);

    expect(view.getByText('Microsoft 365: Не подключён')).toBeOnTheScreen();
    expect(view.getByText('Не подключён')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Обновить сейчас' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Управление' })).toBeOnTheScreen();
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
