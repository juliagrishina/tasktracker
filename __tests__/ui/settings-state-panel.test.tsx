import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { getDefaultSettings } from '../../src/data/default-settings';
import type { NotificationPermissionGateway } from '../../src/application/notification-permissions';
import { SettingsStatePanel } from '../../src/ui/settings/settings-state-panel';

describe('SettingsStatePanel', () => {
  test('selects a manual IANA timezone from the searchable list and can return to the device timezone', async () => {
    const onTimeZoneChange = jest.fn().mockResolvedValue(undefined);
    const onUseDeviceTimeZone = jest.fn().mockResolvedValue(undefined);
    const view = await render(<SettingsStatePanel onTimeZoneChange={onTimeZoneChange} onUseDeviceTimeZone={onUseDeviceTimeZone} settings={{ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow', timeZoneMode: 'manual' }} />);

    fireEvent.press(view.getByLabelText('Часовой пояс'));
    await waitFor(() => expect(view.getByLabelText('Поиск часового пояса')).toBeOnTheScreen());
    fireEvent.changeText(view.getByLabelText('Поиск часового пояса'), 'berlin');
    await waitFor(() => expect(view.getByRole('button', { name: 'Europe/Berlin' })).toBeOnTheScreen());
    fireEvent.press(view.getByRole('button', { name: 'Europe/Berlin' }));

    await waitFor(() => expect(onTimeZoneChange).toHaveBeenCalledWith('Europe/Berlin'));
    fireEvent.press(view.getByRole('button', { name: 'Использовать пояс устройства' }));
    await waitFor(() => expect(onUseDeviceTimeZone).toHaveBeenCalledTimes(1));
  });

  test('saves editable planning settings from the settings screen', async () => {
    const onPlanningSettingsChange = jest.fn().mockResolvedValue(undefined);
    const view = await render(<SettingsStatePanel onPlanningSettingsChange={onPlanningSettingsChange} settings={getDefaultSettings()} />);

    fireEvent.press(view.getByRole('button', { name: 'Изменить' }));
    await waitFor(() => expect(view.getByLabelText('Начало рабочего дня')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Начало рабочего дня'));
    await waitFor(() => expect(view.getByRole('button', { name: '07:00' })).toBeOnTheScreen());
    fireEvent.press(view.getByRole('button', { name: '07:00' }));
    await waitFor(() => expect(view.getByLabelText('Начало рабочего дня')).toHaveTextContent(/07:00/));
    fireEvent.press(view.getByLabelText('Конец рабочего дня'));
    await waitFor(() => expect(view.getByRole('button', { name: '21:00' })).toBeOnTheScreen());
    fireEvent.press(view.getByRole('button', { name: '21:00' }));
    await waitFor(() => expect(view.getByLabelText('Конец рабочего дня')).toHaveTextContent(/21:00/));
    fireEvent.press(view.getByLabelText('Время вечерней проверки'));
    await waitFor(() => expect(view.getByRole('button', { name: '20:45' })).toBeOnTheScreen());
    fireEvent.press(view.getByRole('button', { name: '20:45' }));
    await waitFor(() => expect(view.getByLabelText('Время вечерней проверки')).toHaveTextContent(/20:45/));
    fireEvent.press(view.getByRole('button', { name: 'Сохранить параметры плана' }));

    await waitFor(() => expect(onPlanningSettingsChange).toHaveBeenCalledWith({
      workdayStartsAt: '07:00',
      workdayEndsAt: '21:00',
      eveningReviewAt: '20:45',
      notificationLeadMinutes: 10,
    }));
  });

  test('edits the notification lead time from the Notifications card', async () => {
    const onPlanningSettingsChange = jest.fn().mockResolvedValue(undefined);
    const view = await render(<SettingsStatePanel onPlanningSettingsChange={onPlanningSettingsChange} settings={getDefaultSettings()} />);

    fireEvent.press(view.getByLabelText('Предварительное'));
    await waitFor(() => expect(view.getByLabelText('Интервал уведомления')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Интервал уведомления'));
    await waitFor(() => expect(view.getByRole('button', { name: '30 минут' })).toBeOnTheScreen());
    fireEvent.press(view.getByRole('button', { name: '30 минут' }));
    await waitFor(() => expect(view.getByLabelText('Интервал уведомления')).toHaveTextContent(/30 минут/));
    fireEvent.press(view.getByRole('button', { name: 'Сохранить интервал' }));

    await waitFor(() => expect(onPlanningSettingsChange).toHaveBeenCalledWith({
      workdayStartsAt: '08:00',
      workdayEndsAt: '22:00',
      eveningReviewAt: '21:00',
      notificationLeadMinutes: 30,
    }));
  });

  test('renders the approved Settings 2 state cards', async () => {
    const view = await render(<SettingsStatePanel settings={getDefaultSettings()} />);

    expect(view.getByText('Microsoft 365: Не подключён')).toBeOnTheScreen();
    expect(view.getByText('Не подключён')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Обновить сейчас' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Управление' })).toBeOnTheScreen();
    expect(view.getByText('Рабочий диапазон')).toBeOnTheScreen();
    expect(view.getByText('Уведомления')).toBeOnTheScreen();
    expect(view.getByText('Данные на этом устройстве')).toBeOnTheScreen();
    expect(view.getByText(/При удалении приложения или переходе на другое устройство эти данные не восстанавливаются/)).toBeOnTheScreen();
    expect(view.getByText(/Версия/)).toBeOnTheScreen();
  });

  test('keeps the Microsoft 365 refresh action inside local demo state', async () => {
    const view = await render(<SettingsStatePanel settings={getDefaultSettings()} />);

    fireEvent.press(view.getByRole('button', { name: 'Обновить сейчас' }));

    await waitFor(() => {
      expect(view.getByText('Статус обновлён в демо-режиме')).toBeOnTheScreen();
    });
  });

  test('keeps the planner usable when local notification permission is declined', async () => {
    const notificationPermissions: NotificationPermissionGateway = {
      getStatus: jest.fn().mockResolvedValue('undetermined'),
      requestPermission: jest.fn().mockResolvedValue('denied'),
    };
    const view = await render(<SettingsStatePanel notificationPermissions={notificationPermissions} settings={getDefaultSettings()} />);

    await waitFor(() => expect(view.getByRole('button', { name: 'Настроить уведомления' })).toBeOnTheScreen());
    fireEvent.press(view.getByRole('button', { name: 'Настроить уведомления' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Разрешить уведомления' })).toBeOnTheScreen());
    fireEvent.press(view.getByRole('button', { name: 'Разрешить уведомления' }));

    await waitFor(() => {
      expect(notificationPermissions.requestPermission).toHaveBeenCalledTimes(1);
      expect(view.getByText('Не разрешены')).toBeOnTheScreen();
      expect(view.getByText(/Планирование и отметка дел останутся доступными/)).toBeOnTheScreen();
    });
  });
});
