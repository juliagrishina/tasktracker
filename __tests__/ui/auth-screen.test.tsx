import { fireEvent, render } from '@testing-library/react-native';

import { AuthScreen } from '../../src/ui/auth/auth-screen';

describe('AuthScreen', () => {
  test('shows registration first and lets the user switch to login', async () => {
    const view = await render(<AuthScreen onContinueWithoutAccount={jest.fn()} />);

    expect(view.getByText('Создать аккаунт')).toBeOnTheScreen();
    expect(view.getByLabelText('Имя')).toBeOnTheScreen();
    expect(view.getByLabelText('Email')).toBeOnTheScreen();
    expect(view.getByLabelText('Пароль')).toBeOnTheScreen();
    expect(view.getByLabelText('Повторите пароль')).toBeOnTheScreen();

    await fireEvent.press(view.getByLabelText('Перейти ко входу'));

    expect(view.getByText('Войти')).toBeOnTheScreen();
    expect(view.queryByLabelText('Имя')).toBeNull();
    expect(view.getByLabelText('Забыли пароль?')).toBeOnTheScreen();
  });

  test('does not expose the guest entry action in the default product mode', async () => {
    const view = await render(<AuthScreen onContinueWithoutAccount={jest.fn()} />);

    expect(view.queryByLabelText('Продолжить без аккаунта')).toBeNull();
  });

  test('keeps the guest entry implementation available behind an explicit enablement', async () => {
    const continueWithoutAccount = jest.fn();
    const view = await render(<AuthScreen allowGuestAccess onContinueWithoutAccount={continueWithoutAccount} />);

    await fireEvent.press(view.getByLabelText('Продолжить без аккаунта'));

    expect(continueWithoutAccount).toHaveBeenCalledTimes(1);
  });

  test('lets the user reveal and hide each registration password independently', async () => {
    const view = await render(<AuthScreen onContinueWithoutAccount={jest.fn()} />);
    const password = view.getByLabelText('Пароль');
    const passwordConfirmation = view.getByLabelText('Повторите пароль');

    expect(password.props.secureTextEntry).toBe(true);
    expect(passwordConfirmation.props.secureTextEntry).toBe(true);

    await fireEvent.press(view.getByRole('button', { name: 'Показать пароль' }));

    expect(view.getByLabelText('Пароль').props.secureTextEntry).toBe(false);
    expect(view.getByLabelText('Повторите пароль').props.secureTextEntry).toBe(true);
    expect(view.getByRole('button', { name: 'Скрыть пароль' })).toBeOnTheScreen();

    await fireEvent.press(view.getByRole('button', { name: 'Показать повтор пароля' }));

    expect(view.getByLabelText('Повторите пароль').props.secureTextEntry).toBe(false);
    expect(view.getByRole('button', { name: 'Скрыть повтор пароля' })).toBeOnTheScreen();
  });

  test('recreates a password input after visibility changes while preserving its value', async () => {
    const view = await render(<AuthScreen onContinueWithoutAccount={jest.fn()} />);
    const passwordBeforeToggle = view.getByLabelText('Пароль');

    await fireEvent.changeText(passwordBeforeToggle, 'Test1!Visible');
    await fireEvent.press(view.getByRole('button', { name: 'Показать пароль' }));

    const passwordAfterToggle = view.getByLabelText('Пароль');
    expect(passwordAfterToggle).not.toBe(passwordBeforeToggle);
    expect(passwordAfterToggle.props.value).toBe('Test1!Visible');
    expect(passwordAfterToggle.props.secureTextEntry).toBe(false);
  });
});
