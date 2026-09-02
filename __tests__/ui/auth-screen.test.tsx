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

  test('allows an offline start without an account', async () => {
    const continueWithoutAccount = jest.fn();
    const view = await render(<AuthScreen onContinueWithoutAccount={continueWithoutAccount} />);

    await fireEvent.press(view.getByLabelText('Продолжить без аккаунта'));

    expect(continueWithoutAccount).toHaveBeenCalledTimes(1);
  });
});
