import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { getDefaultSettings } from '../../src/data/default-settings';
import type { NotificationPermissionGateway } from '../../src/application/notification-permissions';
import { SettingsStatePanel } from '../../src/ui/settings/settings-state-panel';

describe('SettingsStatePanel', () => {
  test('selects a manual IANA timezone from the searchable list and can return to the device timezone', async () => {
    const onTimeZoneChange = jest.fn().mockResolvedValue(undefined);
    const onUseDeviceTimeZone = jest.fn().mockResolvedValue(undefined);
    const view = await render(<SettingsStatePanel onTimeZoneChange={onTimeZoneChange} onUseDeviceTimeZone={onUseDeviceTimeZone} settings={{ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow', timeZoneMode: 'manual' }} />);

    await fireEvent.press(view.getByLabelText('Часовой пояс'));
    await waitFor(() => expect(view.getByLabelText('Поиск часового пояса')).toBeOnTheScreen());
    await fireEvent.changeText(view.getByLabelText('Поиск часового пояса'), 'berlin');
    await waitFor(() => expect(view.getByRole('button', { name: 'Europe/Berlin' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Europe/Berlin' }));

    await waitFor(() => expect(onTimeZoneChange).toHaveBeenCalledWith('Europe/Berlin'));
    await fireEvent.press(view.getByRole('button', { name: 'Использовать пояс устройства' }));
    await waitFor(() => expect(onUseDeviceTimeZone).toHaveBeenCalledTimes(1));
  });

  test('saves editable planning settings from the settings screen', async () => {
    const onPlanningSettingsChange = jest.fn().mockResolvedValue(undefined);
    const view = await render(<SettingsStatePanel onPlanningSettingsChange={onPlanningSettingsChange} settings={getDefaultSettings()} />);

    await fireEvent.press(view.getByRole('button', { name: 'Изменить' }));
    await waitFor(() => expect(view.getByLabelText('Начало рабочего дня')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Начало рабочего дня'));
    await waitFor(() => expect(view.getByRole('button', { name: '07:00' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: '07:00' }));
    await waitFor(() => expect(view.getByLabelText('Начало рабочего дня')).toHaveTextContent(/07:00/));
    await fireEvent.press(view.getByLabelText('Конец рабочего дня'));
    await waitFor(() => expect(view.getByRole('button', { name: '21:00' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: '21:00' }));
    await waitFor(() => expect(view.getByLabelText('Конец рабочего дня')).toHaveTextContent(/21:00/));
    await fireEvent.press(view.getByLabelText('Время вечерней проверки'));
    await waitFor(() => expect(view.getByRole('button', { name: '20:45' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: '20:45' }));
    await waitFor(() => expect(view.getByLabelText('Время вечерней проверки')).toHaveTextContent(/20:45/));
    await fireEvent.press(view.getByRole('button', { name: 'Сохранить параметры плана' }));

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

    await fireEvent.press(view.getByLabelText('Предварительное'));
    await waitFor(() => expect(view.getByLabelText('Интервал уведомления')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Интервал уведомления'));
    await waitFor(() => expect(view.getByRole('button', { name: '30 минут' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: '30 минут' }));
    await waitFor(() => expect(view.getByLabelText('Интервал уведомления')).toHaveTextContent(/30 минут/));
    await fireEvent.press(view.getByRole('button', { name: 'Сохранить интервал' }));

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
    expect(view.getByText('Данные аккаунта и устройства')).toBeOnTheScreen();
    expect(view.getByText(/При удалении приложения или переходе на другое устройство эти данные не восстанавливаются/)).toBeOnTheScreen();
    expect(view.getByText(/Версия/)).toBeOnTheScreen();
  });

  test('requires explicit confirmation before clearing only autonomous data', async () => {
    const onClearAutonomousData = jest.fn().mockResolvedValue(undefined);
    const view = await render(<SettingsStatePanel account={{ kind: 'withoutAccount' }} onClearAutonomousData={onClearAutonomousData} settings={getDefaultSettings()} />);

    await fireEvent.press(view.getByRole('button', { name: 'Очистить все данные' }));
    expect(view.getByText('Вы действительно хотите удалить все локальные данные на этом устройстве?')).toBeOnTheScreen();
    expect(onClearAutonomousData).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Удалить все данные' }));

    await waitFor(() => expect(onClearAutonomousData).toHaveBeenCalledTimes(1));
  });

  test('requires password and a six-digit email code before deleting an authenticated account', async () => {
    const onAccountDataAction = jest.fn().mockResolvedValue(true);
    const onRequestAccountDataCode = jest.fn().mockResolvedValue({ kind: 'codeSent' });
    const view = await render(<SettingsStatePanel
      account={{ kind: 'authenticated', displayName: 'Юлия', email: 'julia@example.com', emailConfirmed: true, pendingEmail: null }}
      onAccountDataAction={onAccountDataAction}
      onRequestAccountDataCode={onRequestAccountDataCode}
      settings={getDefaultSettings()}
    />);

    await fireEvent.press(view.getByRole('button', { name: 'Удалить аккаунт' }));
    expect(view.getByText(/будут безвозвратно удалены аккаунт/u)).toBeOnTheScreen();
    await fireEvent.changeText(view.getByLabelText('Текущий пароль для удаления'), 'Current!Pass1');
    await fireEvent.press(view.getByRole('button', { name: 'Отправить код подтверждения' }));
    await fireEvent.changeText(view.getByLabelText('Код подтверждения удаления'), '123456');
    await fireEvent.press(view.getByRole('button', { name: 'Удалить аккаунт безвозвратно' }));

    await waitFor(() => expect(onRequestAccountDataCode).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onAccountDataAction).toHaveBeenCalledWith({ operation: 'delete_account', password: 'Current!Pass1', code: '123456' }));
  });

  test('keeps the Microsoft 365 refresh action inside local demo state', async () => {
    const view = await render(<SettingsStatePanel settings={getDefaultSettings()} />);

    await fireEvent.press(view.getByRole('button', { name: 'Обновить сейчас' }));

    await waitFor(() => {
      expect(view.getByText('Статус обновлён в демо-режиме')).toBeOnTheScreen();
    });
  });

  test('offers explicit choices for an edit-versus-delete sync conflict', async () => {
    const onResolveSyncConflict = jest.fn().mockResolvedValue(undefined);
    const view = await render(<SettingsStatePanel
      onResolveSyncConflict={onResolveSyncConflict}
      settings={getDefaultSettings()}
      syncConflicts={[{
        id: 'conflict-1',
        local: { mutationId: 'm-1', deviceId: 'device-1', entityType: 'task_items', entityId: 'task-1', operation: 'upsert', expectedVersion: 1, dataGeneration: 1, payload: { id: 'task-1', title: 'Черновик' }, createdAt: '2026-09-04T08:00:00.000Z' },
        server: { operation: 'delete', version: 2, payload: { id: 'task-1' }, changedAt: '2026-09-04T08:01:00.000Z', deviceId: null },
        createdAt: '2026-09-04T08:02:00.000Z',
      }]}
    />);

    expect(view.getByText(/Требуется разрешить конфликт синхронизации/)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Восстановить изменённую запись' }));
    await waitFor(() => expect(onResolveSyncConflict).toHaveBeenCalledWith(expect.objectContaining({ id: 'conflict-1' }), 'keep_local'));
  });

  test('shows a safe failed sync status, pending changes and a retry action', async () => {
    const onSyncAccountData = jest.fn().mockResolvedValue(undefined);
    const view = await render(<SettingsStatePanel
      account={{ kind: 'authenticated', displayName: 'Юлия', email: 'julia@example.com', emailConfirmed: true, pendingEmail: null }}
      onSyncAccountData={onSyncAccountData}
      settings={getDefaultSettings()}
      syncStatus={{ kind: 'failed', pendingCount: 3, lastSuccessAt: '2026-09-04T10:00:00.000Z' }}
    />);

    expect(view.getByText('Не удалось синхронизировать')).toBeOnTheScreen();
    expect(view.getByText('Ожидают отправки: 3')).toBeOnTheScreen();
    expect(view.queryByText(/SQL|JWT|stack trace/u)).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(onSyncAccountData).toHaveBeenCalledTimes(1));
  });

  test.each([
    ['syncing', 'Синхронизация…'],
    ['synchronized', 'Синхронизировано'],
    ['offline', 'Нет сети — изменения сохранены на устройстве'],
  ] as const)('shows the %s account synchronization state', async (kind, label) => {
    const view = await render(<SettingsStatePanel
      account={{ kind: 'authenticated', displayName: 'Юлия', email: 'julia@example.com', emailConfirmed: true, pendingEmail: null }}
      settings={getDefaultSettings()}
      syncStatus={{ kind, pendingCount: 0, lastSuccessAt: null }}
    />);

    expect(view.getByText(label)).toBeOnTheScreen();
  });

  test('keeps the planner usable when local notification permission is declined', async () => {
    const notificationPermissions: NotificationPermissionGateway = {
      getStatus: jest.fn().mockResolvedValue('undetermined'),
      requestPermission: jest.fn().mockResolvedValue('denied'),
    };
    const view = await render(<SettingsStatePanel notificationPermissions={notificationPermissions} settings={getDefaultSettings()} />);

    await waitFor(() => expect(view.getByRole('button', { name: 'Настроить уведомления' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Настроить уведомления' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Разрешить уведомления' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Разрешить уведомления' }));

    await waitFor(() => {
      expect(notificationPermissions.requestPermission).toHaveBeenCalledTimes(1);
      expect(view.getByText('Не разрешены')).toBeOnTheScreen();
      expect(view.getByText(/Планирование и отметка дел останутся доступными/)).toBeOnTheScreen();
    });
  });
});
