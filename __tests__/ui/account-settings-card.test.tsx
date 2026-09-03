import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { AccountProfileResult, AccountProfileState } from '../../src/application/account-profile';
import { AccountSettingsCard } from '../../src/ui/settings/account-settings-card';

const authenticatedAccount: AccountProfileState = {
  kind: 'authenticated',
  displayName: 'Мария Иванова',
  email: 'maria@example.com',
  emailConfirmed: true,
  pendingEmail: null,
};

describe('AccountSettingsCard', () => {
  test('shows the confirmed Auth account at the top and starts a password-protected email change', async () => {
    const onUpdateDisplayName = jest.fn<Promise<AccountProfileResult>, [string]>().mockResolvedValue({ kind: 'displayNameUpdated', displayName: 'Мария Петрова' });
    const onStartEmailChange = jest.fn<Promise<AccountProfileResult>, [{ currentPassword: string; email: string }]>().mockResolvedValue({ kind: 'pendingEmailChange', email: 'new@example.com' });
    const view = await render(<AccountSettingsCard account={authenticatedAccount} onStartEmailChange={onStartEmailChange} onUpdateDisplayName={onUpdateDisplayName} />);

    expect(view.getByText('Аккаунт')).toBeOnTheScreen();
    expect(view.getByText('Мария Иванова')).toBeOnTheScreen();
    expect(view.getByText('maria@example.com')).toBeOnTheScreen();
    expect(view.getByText('Почта подтверждена')).toBeOnTheScreen();

    await fireEvent.press(view.getByRole('button', { name: 'Редактировать аккаунт' }));
    await fireEvent.changeText(view.getByLabelText('Имя аккаунта'), 'Мария Петрова');
    await fireEvent.press(view.getByRole('button', { name: 'Сохранить имя' }));
    await waitFor(() => expect(onUpdateDisplayName).toHaveBeenCalledWith('Мария Петрова'));

    await fireEvent.changeText(view.getByLabelText('Текущий пароль для смены email'), 'Current!123');
    await fireEvent.changeText(view.getByLabelText('Новый email'), 'new@example.com');
    await fireEvent.press(view.getByRole('button', { name: 'Отправить код на новый email' }));
    await waitFor(() => expect(onStartEmailChange).toHaveBeenCalledWith({ currentPassword: 'Current!123', email: 'new@example.com' }));
  });

  test('lets the user confirm or cancel the visible pending email address', async () => {
    const onConfirmEmailChange = jest.fn<Promise<AccountProfileResult>, [{ code: string }]>().mockResolvedValue({ kind: 'emailChanged', email: 'new@example.com' });
    const onCancelEmailChange = jest.fn<Promise<AccountProfileResult>, []>().mockResolvedValue({ kind: 'emailChangeCancelled' });
    const view = await render(
      <AccountSettingsCard
        account={{ ...authenticatedAccount, pendingEmail: 'new@example.com' }}
        onCancelEmailChange={onCancelEmailChange}
        onConfirmEmailChange={onConfirmEmailChange}
      />,
    );

    expect(view.getByText('Ожидает подтверждения: new@example.com')).toBeOnTheScreen();
    await fireEvent.changeText(view.getByLabelText('Код подтверждения нового email'), '123456');
    await fireEvent.press(view.getByRole('button', { name: 'Подтвердить новый email' }));
    await waitFor(() => expect(onConfirmEmailChange).toHaveBeenCalledWith({ code: '123456' }));
    await fireEvent.press(view.getByRole('button', { name: 'Отменить смену email' }));
    await waitFor(() => expect(onCancelEmailChange).toHaveBeenCalledTimes(1));
  });

  test('offers sign-in and registration for the autonomous area', async () => {
    const onSignIn = jest.fn();
    const onSignUp = jest.fn();
    const view = await render(<AccountSettingsCard account={{ kind: 'withoutAccount' }} onSignIn={onSignIn} onSignUp={onSignUp} />);

    expect(view.getByText('Без аккаунта')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Войти' }));
    await fireEvent.press(view.getByRole('button', { name: 'Создать аккаунт' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });

  test('shows a recoverable message when an account action cannot be completed', async () => {
    const onUpdateDisplayName = jest.fn<Promise<AccountProfileResult>, [string]>().mockRejectedValue(new Error('network unavailable'));
    const view = await render(<AccountSettingsCard account={authenticatedAccount} onUpdateDisplayName={onUpdateDisplayName} />);

    await fireEvent.press(view.getByRole('button', { name: 'Редактировать аккаунт' }));
    await fireEvent.press(view.getByRole('button', { name: 'Сохранить имя' }));

    await waitFor(() => expect(view.getByText('Не удалось обновить данные аккаунта. Проверьте подключение к интернету.')).toBeOnTheScreen());
  });
});
