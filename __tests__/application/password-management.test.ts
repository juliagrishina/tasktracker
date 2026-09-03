import { createPasswordManagement, PasswordManagementGatewayError } from '../../src/application/password-management';

describe('password management', () => {
  test('changes a password only after the current password and six-digit email code, keeping this device signed in', async () => {
    const gateway = createGateway();
    const service = createPasswordManagement({ gateway, now: () => 1_000 });

    await expect(service.requestPasswordChangeCode()).resolves.toEqual({ kind: 'codeSent' });
    await expect(service.changePassword({
      currentPassword: 'Current!123',
      code: '123456',
      password: 'NewPassword!42',
      passwordConfirmation: 'NewPassword!42',
    })).resolves.toEqual({ kind: 'passwordChanged' });

    expect(gateway.sendChangeCode).toHaveBeenCalledWith();
    expect(gateway.verifyChangeCode).toHaveBeenCalledWith({ email: 'maria@example.com', code: '123456' });
    expect(gateway.setPassword).toHaveBeenCalledWith({ currentPassword: 'Current!123', password: 'NewPassword!42' });
  });

  test('does not submit a password change after three rejected email codes until a new code is requested', async () => {
    const gateway = createGateway();
    gateway.verifyChangeCode.mockRejectedValue(new Error('invalid nonce'));
    const service = createPasswordManagement({ gateway, now: () => 1_000 });
    await service.requestPasswordChangeCode();

    const input = { currentPassword: 'Current!123', code: '123456', password: 'NewPassword!42', passwordConfirmation: 'NewPassword!42' };
    await expect(service.changePassword(input)).resolves.toEqual({ kind: 'incorrectCode', attemptsRemaining: 2 });
    await expect(service.changePassword(input)).resolves.toEqual({ kind: 'incorrectCode', attemptsRemaining: 1 });
    await expect(service.changePassword(input)).resolves.toEqual({ kind: 'codeInvalidated' });
    await expect(service.changePassword(input)).resolves.toEqual({ kind: 'codeInvalidated' });
    expect(gateway.verifyChangeCode).toHaveBeenCalledTimes(3);
  });

  test('does not change a password when the current password is rejected', async () => {
    const gateway = createGateway();
    gateway.setPassword.mockRejectedValue(new PasswordManagementGatewayError('invalidCurrentPassword'));
    const service = createPasswordManagement({ gateway, now: () => 1_000 });
    await service.requestPasswordChangeCode();

    await expect(service.changePassword({
      currentPassword: 'wrong',
      code: '123456',
      password: 'NewPassword!42',
      passwordConfirmation: 'NewPassword!42',
    })).resolves.toEqual({
      kind: 'validationError',
      message: 'Текущий пароль неверный.',
    });

    expect(gateway.setPassword).toHaveBeenCalledWith({ currentPassword: 'wrong', password: 'NewPassword!42' });
  });

  test('does not count a connection failure as an incorrect change code', async () => {
    const gateway = createGateway();
    gateway.verifyChangeCode.mockRejectedValue(new PasswordManagementGatewayError('requestFailed'));
    const service = createPasswordManagement({ gateway, now: () => 1_000 });
    await service.requestPasswordChangeCode();

    await expect(service.changePassword({
      currentPassword: 'Current!123',
      code: '123456',
      password: 'NewPassword!42',
      passwordConfirmation: 'NewPassword!42',
    })).resolves.toEqual({
      kind: 'requestFailed',
      message: 'Не удалось проверить код. Проверьте подключение к интернету.',
    });
  });

  test('uses a neutral recovery request and creates a password from the verified recovery session', async () => {
    const gateway = createGateway();
    const service = createPasswordManagement({ gateway, now: () => 1_000 });

    await expect(service.requestPasswordRecovery('maria@example.com')).resolves.toEqual({ kind: 'recoveryRequested' });
    await expect(service.completePasswordRecovery({
      email: 'maria@example.com',
      code: '123456',
      password: 'Recovered!42',
      passwordConfirmation: 'Recovered!42',
    })).resolves.toEqual({ kind: 'passwordRecovered' });

    expect(gateway.sendRecoveryCode).toHaveBeenCalledWith({ email: 'maria@example.com' });
    expect(gateway.verifyRecoveryCode).toHaveBeenCalledWith({ email: 'maria@example.com', code: '123456' });
    expect(gateway.setRecoveredPassword).toHaveBeenCalledWith({ password: 'Recovered!42' });
  });
});

function createGateway() {
  return {
    sendChangeCode: jest.fn<Promise<{ email: string }>, []>().mockResolvedValue({ email: 'maria@example.com' }),
    verifyChangeCode: jest.fn<Promise<void>, [{ email: string; code: string }]>().mockResolvedValue(undefined),
    setPassword: jest.fn<Promise<void>, [{ currentPassword: string; password: string }]>().mockResolvedValue(undefined),
    sendRecoveryCode: jest.fn<Promise<void>, [{ email: string }]>().mockResolvedValue(undefined),
    verifyRecoveryCode: jest.fn<Promise<void>, [{ email: string; code: string }]>().mockResolvedValue(undefined),
    setRecoveredPassword: jest.fn<Promise<void>, [{ password: string }]>().mockResolvedValue(undefined),
  };
}
