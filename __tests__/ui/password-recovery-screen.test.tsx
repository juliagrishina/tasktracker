import { fireEvent, render } from '@testing-library/react-native';

import { PasswordRecoveryScreen } from '../../src/ui/auth/password-recovery-screen';

describe('PasswordRecoveryScreen', () => {
  test('shows a neutral recovery request and then accepts a six-digit code with a new password', async () => {
    const onRequest = jest.fn();
    const requestView = await render(<PasswordRecoveryScreen email={null} onBack={jest.fn()} onConfirm={jest.fn()} onRequest={onRequest} onResend={jest.fn()} />);

    await fireEvent.changeText(requestView.getByLabelText('Email для восстановления'), 'maria@example.com');
    await fireEvent.press(requestView.getByRole('button', { name: 'Отправить код' }));
    expect(onRequest).toHaveBeenCalledWith({ email: 'maria@example.com' });

    const onConfirm = jest.fn();
    const confirmView = await render(<PasswordRecoveryScreen email="maria@example.com" onBack={jest.fn()} onConfirm={onConfirm} onRequest={jest.fn()} onResend={jest.fn()} />);
    expect(confirmView.getByText(/Если такой аккаунт существует/u)).toBeOnTheScreen();
    await fireEvent.changeText(confirmView.getByLabelText('Код восстановления'), '123456');
    await fireEvent.changeText(confirmView.getByLabelText('Новый пароль'), 'Recovered!42');
    await fireEvent.changeText(confirmView.getByLabelText('Повторите новый пароль'), 'Recovered!42');
    await fireEvent.press(confirmView.getByRole('button', { name: 'Сохранить новый пароль' }));

    expect(onConfirm).toHaveBeenCalledWith({ code: '123456', email: 'maria@example.com', password: 'Recovered!42', passwordConfirmation: 'Recovered!42' });
  });
});
