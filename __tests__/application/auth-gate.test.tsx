import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { AuthGate, useAuthGateNavigation } from '../../src/application/auth-gate';
import { createAccountRegistration, createMemoryPendingRegistrationStore } from '../../src/application/account-registration';
import { createPasswordManagement } from '../../src/application/password-management';
import { createAuthEntryState } from '../../src/data/auth-entry-state';
import { createDataScopeRegistry } from '../../src/data/local-data-scopes';

describe('AuthGate', () => {
  test('keeps first launch on Auth and opens only the autonomous area after an explicit choice', async () => {
    const storage = createMemoryStorage();
    const scopes = createDataScopeRegistry(storage);
    const view = await render(
      <AuthGate
        authGateway={{
          restoreSession: async () => ({ kind: 'signedOut' }),
          startAutonomousSession: async () => ({ kind: 'autonomous', userId: null }),
        }}
        entryState={createAuthEntryState(storage)}
        scopeRegistry={scopes}>
        <Text>Основной экран</Text>
      </AuthGate>,
    );

    await waitFor(() => expect(view.getByText('Создать аккаунт')).toBeOnTheScreen());
    expect(view.queryByText('Основной экран')).toBeNull();

    await fireEvent.press(view.getByLabelText('Продолжить без аккаунта'));

    await waitFor(() => expect(view.getByText('Основной экран')).toBeOnTheScreen());
    await expect(scopes.getActiveScope()).resolves.toEqual({ kind: 'autonomous' });
  });

  test('opens the autonomous area even when anonymous Supabase sign-in is unavailable offline', async () => {
    const storage = createMemoryStorage();
    const view = await render(
      <AuthGate
        authGateway={{
          restoreSession: async () => ({ kind: 'signedOut' }),
          startAutonomousSession: async () => {
            throw new Error('Network unavailable');
          },
        }}
        entryState={createAuthEntryState(storage)}
        scopeRegistry={createDataScopeRegistry(storage)}>
        <Text>Основной экран</Text>
      </AuthGate>,
    );

    await waitFor(() => expect(view.getByText('Создать аккаунт')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Продолжить без аккаунта'));

    await waitFor(() => expect(view.getByText('Основной экран')).toBeOnTheScreen());
  });

  test('offers an explicit import choice after signing in when autonomous data exist', async () => {
    const storage = createMemoryStorage();
    const scopes = createDataScopeRegistry(storage);
    const importIntoAccount = jest.fn().mockResolvedValue(undefined);
    const view = await render(
      <AuthGate
        authGateway={{
          restoreSession: async () => ({ kind: 'signedOut' }),
          startAutonomousSession: async () => ({ kind: 'autonomous', userId: null }),
          signInWithPassword: async () => ({ kind: 'authenticated', userId: 'account-17', email: 'anna@example.com' }),
        }}
        entryState={createAuthEntryState(storage)}
        scopeRegistry={scopes}
        workspaceTransfer={{
          hasAutonomousData: async () => true,
          importIntoAccount,
        }}>
        <Text>Основной экран</Text>
      </AuthGate>,
    );

    await waitFor(() => expect(view.getByText('Создать аккаунт')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Перейти ко входу'));
    await fireEvent.changeText(view.getByLabelText('Email'), 'anna@example.com');
    await fireEvent.changeText(view.getByLabelText('Пароль'), 'P@ssword2026');
    await fireEvent.press(view.getByText('Войти'));

    await waitFor(() => expect(view.getByText('Как поступить с данными на этом устройстве?')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Объединить с данными аккаунта'));

    await waitFor(() => expect(view.getByText('Основной экран')).toBeOnTheScreen());
    expect(importIntoAccount).toHaveBeenCalledWith('account-17');
    await expect(scopes.getActiveScope()).resolves.toEqual({ kind: 'account', accountId: 'account-17' });
  });

  test('opens an empty account replica without altering autonomous data when the user declines import', async () => {
    const storage = createMemoryStorage();
    const scopes = createDataScopeRegistry(storage);
    const importIntoAccount = jest.fn();
    const view = await render(
      <AuthGate
        authGateway={{
          restoreSession: async () => ({ kind: 'signedOut' }),
          startAutonomousSession: async () => ({ kind: 'autonomous', userId: null }),
          signInWithPassword: async () => ({ kind: 'authenticated', userId: 'account-17', email: 'anna@example.com' }),
        }}
        entryState={createAuthEntryState(storage)}
        scopeRegistry={scopes}
        workspaceTransfer={{
          hasAutonomousData: async () => true,
          importIntoAccount,
        }}>
        <Text>Основной экран</Text>
      </AuthGate>,
    );

    await waitFor(() => expect(view.getByText('Создать аккаунт')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Перейти ко входу'));
    await fireEvent.changeText(view.getByLabelText('Email'), 'anna@example.com');
    await fireEvent.changeText(view.getByLabelText('Пароль'), 'P@ssword2026');
    await fireEvent.press(view.getByText('Войти'));
    await waitFor(() => expect(view.getByText('Как поступить с данными на этом устройстве?')).toBeOnTheScreen());

    await fireEvent.press(view.getByLabelText('Не переносить'));

    await waitFor(() => expect(view.getByText('Основной экран')).toBeOnTheScreen());
    expect(importIntoAccount).not.toHaveBeenCalled();
    await expect(scopes.getActiveScope()).resolves.toEqual({ kind: 'account', accountId: 'account-17' });
  });

  test('moves a valid registration into masked email verification without persisting the password', async () => {
    const storage = createMemoryStorage();
    const pendingStore = createMemoryPendingRegistrationStore();
    const registration = createAccountRegistration({
      now: () => 1_000,
      store: pendingStore,
      gateway: {
        linkEmailIdentity: async () => ({ userId: 'anon-user-17' }),
        verifyEmailCode: async () => {},
        setPassword: async () => {},
        completeAccountSetup: async () => {},
        resendEmailCode: async () => {},
      },
    });
    const view = await render(
      <AuthGate
        authGateway={{
          restoreSession: async () => ({ kind: 'autonomous', userId: 'anon-user-17' }),
          startAutonomousSession: async () => ({ kind: 'autonomous', userId: 'anon-user-17' }),
        }}
        entryState={createAuthEntryState(storage)}
        registration={registration}
        scopeRegistry={createDataScopeRegistry(storage)}>
        <Text>Основной экран</Text>
      </AuthGate>,
    );

    await waitFor(() => expect(view.getByText('Создать аккаунт')).toBeOnTheScreen());
    await fireEvent.changeText(view.getByLabelText('Имя'), 'Мария Иванова');
    await fireEvent.changeText(view.getByLabelText('Email'), 'maria@example.com');
    await fireEvent.changeText(view.getByLabelText('Пароль'), 'P@ssword2026');
    await fireEvent.changeText(view.getByLabelText('Повторите пароль'), 'P@ssword2026');
    await fireEvent.press(view.getByLabelText('Принять Пользовательское соглашение и Политику конфиденциальности'));
    await fireEvent.press(view.getByText('Создать аккаунт'));

    await waitFor(() => expect(view.getByText('Подтвердите email')).toBeOnTheScreen());
    expect(view.getByText(/m\*\*\*@example\.com/u)).toBeOnTheScreen();
    await expect(pendingStore.load()).resolves.toMatchObject({ email: 'maria@example.com' });
  });

  test('creates an anonymous identity before linking a first-launch registration', async () => {
    const storage = createMemoryStorage();
    const registration = createAccountRegistration({
      store: createMemoryPendingRegistrationStore(),
      gateway: {
        linkEmailIdentity: async () => ({ userId: 'anon-user-17' }),
        verifyEmailCode: async () => {},
        setPassword: async () => {},
        completeAccountSetup: async () => {},
        resendEmailCode: async () => {},
      },
    });
    let anonymousStarts = 0;
    const view = await render(
      <AuthGate
        authGateway={{
          restoreSession: async () => ({ kind: 'signedOut' }),
          startAutonomousSession: async () => {
            anonymousStarts += 1;
            return { kind: 'autonomous', userId: 'anon-user-17' };
          },
        }}
        entryState={createAuthEntryState(storage)}
        registration={registration}
        scopeRegistry={createDataScopeRegistry(storage)}>
        <Text>Основной экран</Text>
      </AuthGate>,
    );

    await waitFor(() => expect(view.getByText('Создать аккаунт')).toBeOnTheScreen());
    await fireEvent.changeText(view.getByLabelText('Имя'), 'Мария Иванова');
    await fireEvent.changeText(view.getByLabelText('Email'), 'maria@example.com');
    await fireEvent.changeText(view.getByLabelText('Пароль'), 'P@ssword2026');
    await fireEvent.changeText(view.getByLabelText('Повторите пароль'), 'P@ssword2026');
    await fireEvent.press(view.getByLabelText('Принять Пользовательское соглашение и Политику конфиденциальности'));
    await fireEvent.press(view.getByText('Создать аккаунт'));

    await waitFor(() => expect(view.getByText('Подтвердите email')).toBeOnTheScreen());
    expect(anonymousStarts).toBe(1);
  });

  test('does not create an anonymous identity when registration input is invalid', async () => {
    const storage = createMemoryStorage();
    let anonymousStarts = 0;
    const view = await render(
      <AuthGate
        authGateway={{
          restoreSession: async () => ({ kind: 'signedOut' }),
          startAutonomousSession: async () => {
            anonymousStarts += 1;
            return { kind: 'autonomous', userId: 'anon-user-17' };
          },
        }}
        entryState={createAuthEntryState(storage)}
        scopeRegistry={createDataScopeRegistry(storage)}>
        <Text>Основной экран</Text>
      </AuthGate>,
    );

    await waitFor(() => expect(view.getByText('Создать аккаунт')).toBeOnTheScreen());
    await fireEvent.press(view.getByText('Создать аккаунт'));

    await waitFor(() => expect(view.getByRole('alert')).toBeOnTheScreen());
    expect(anonymousStarts).toBe(0);
  });

  test('after restart asks for the password again while the email verification remains pending', async () => {
    const storage = createMemoryStorage();
    const registration = createAccountRegistration({
      now: () => 1_000,
      store: createMemoryPendingRegistrationStore({
        userId: 'anon-user-17',
        displayName: 'Мария Иванова',
        email: 'maria@example.com',
        issuedAtMs: 1_000,
        resendAvailableAtMs: 61_000,
        failedAttempts: 0,
        invalidated: false,
      }),
      gateway: {
        linkEmailIdentity: async () => ({ userId: 'anon-user-17' }),
        verifyEmailCode: async () => {},
        setPassword: async () => {},
        completeAccountSetup: async () => {},
        resendEmailCode: async () => {},
      },
    });
    const view = await render(
      <AuthGate
        authGateway={{
          restoreSession: async () => ({ kind: 'pendingVerification', userId: 'anon-user-17', email: 'maria@example.com' }),
          startAutonomousSession: async () => ({ kind: 'autonomous', userId: 'anon-user-17' }),
        }}
        entryState={createAuthEntryState(storage)}
        registration={registration}
        scopeRegistry={createDataScopeRegistry(storage)}>
        <Text>Основной экран</Text>
      </AuthGate>,
    );

    await waitFor(() => expect(view.getByText('Подтвердите email')).toBeOnTheScreen());
    expect(view.getByLabelText('Новый пароль')).toBeOnTheScreen();
    expect(view.getByLabelText('Повторите новый пароль')).toBeOnTheScreen();
  });

  test('keeps the pending registration local-only when the user continues without email confirmation', async () => {
    const storage = createMemoryStorage();
    const registration = createAccountRegistration({
      store: createMemoryPendingRegistrationStore({
        userId: 'anon-user-17',
        displayName: 'Мария Иванова',
        email: 'maria@example.com',
        issuedAtMs: 1_000,
        resendAvailableAtMs: 61_000,
        failedAttempts: 0,
        invalidated: false,
      }),
      gateway: {
        linkEmailIdentity: async () => ({ userId: 'anon-user-17' }),
        verifyEmailCode: async () => {},
        setPassword: async () => {},
        completeAccountSetup: async () => {},
        resendEmailCode: async () => {},
      },
    });
    const view = await render(
      <AuthGate
        authGateway={{
          restoreSession: async () => ({ kind: 'pendingVerification', userId: 'anon-user-17', email: 'maria@example.com' }),
          startAutonomousSession: async () => ({ kind: 'autonomous', userId: 'anon-user-17' }),
        }}
        entryState={createAuthEntryState(storage)}
        registration={registration}
        scopeRegistry={createDataScopeRegistry(storage)}>
        <Text>Основной экран</Text>
      </AuthGate>,
    );

    await waitFor(() => expect(view.getByText('Подтвердите email')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Продолжить локально'));

    await waitFor(() => expect(view.getByText('Основной экран')).toBeOnTheScreen());
  });

  test('opens the neutral password recovery flow from the login form', async () => {
    const storage = createMemoryStorage();
    const passwordManagement = createPasswordManagement({
      gateway: {
        sendChangeCode: async () => ({ email: 'maria@example.com' }),
        verifyChangeCode: async () => {},
        setPassword: async () => {},
        sendRecoveryCode: async () => {},
        verifyRecoveryCode: async () => {},
        setRecoveredPassword: async () => {},
      },
    });
    const view = await render(
      <AuthGate
        authGateway={{
          restoreSession: async () => ({ kind: 'signedOut' }),
          startAutonomousSession: async () => ({ kind: 'autonomous', userId: null }),
        }}
        entryState={createAuthEntryState(storage)}
        passwordManagement={passwordManagement}
        scopeRegistry={createDataScopeRegistry(storage)}>
        <Text>Основной экран</Text>
      </AuthGate>,
    );

    await waitFor(() => expect(view.getByText('Создать аккаунт')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Перейти ко входу'));
    await fireEvent.press(view.getByLabelText('Забыли пароль?'));
    await waitFor(() => expect(view.getByLabelText('Email для восстановления')).toBeOnTheScreen());
    await fireEvent.changeText(view.getByLabelText('Email для восстановления'), 'maria@example.com');
    await fireEvent.press(view.getByRole('button', { name: 'Отправить код' }));
    await waitFor(() => expect(view.getByLabelText('Код восстановления')).toBeOnTheScreen());
  });

  test('signs out into the separate autonomous area even when remote revocation is unavailable, then restores the account area after sign-in', async () => {
    const storage = createMemoryStorage();
    const scopes = createDataScopeRegistry(storage);
    const signOut = jest.fn().mockRejectedValue(new Error('Offline'));
    const view = await render(
      <AuthGate
        authGateway={{
          restoreSession: async () => ({ kind: 'authenticated', userId: 'account-17', email: 'anna@example.com' }),
          startAutonomousSession: async () => ({ kind: 'autonomous', userId: null }),
          signInWithPassword: async () => ({ kind: 'authenticated', userId: 'account-17', email: 'anna@example.com' }),
          signOut,
        }}
        entryState={createAuthEntryState(storage)}
        scopeRegistry={scopes}
        workspaceTransfer={{ hasAutonomousData: async () => false, importIntoAccount: async () => {} }}>
        <SignOutProbe />
      </AuthGate>,
    );

    await waitFor(() => expect(view.getByLabelText('Выйти из аккаунта')).toBeOnTheScreen());
    await expect(scopes.getActiveScope()).resolves.toEqual({ kind: 'account', accountId: 'account-17' });

    await fireEvent.press(view.getByLabelText('Выйти из аккаунта'));

    await waitFor(() => expect(view.getByText('Создать аккаунт')).toBeOnTheScreen());
    expect(signOut).toHaveBeenCalledTimes(1);
    await expect(scopes.getActiveScope()).resolves.toEqual({ kind: 'autonomous' });

    await fireEvent.press(view.getByLabelText('Перейти ко входу'));
    await fireEvent.changeText(view.getByLabelText('Email'), 'anna@example.com');
    await fireEvent.changeText(view.getByLabelText('Пароль'), 'P@ssword2026');
    await fireEvent.press(view.getByText('Войти'));

    await waitFor(() => expect(view.getByLabelText('Выйти из аккаунта')).toBeOnTheScreen());
    await expect(scopes.getActiveScope()).resolves.toEqual({ kind: 'account', accountId: 'account-17' });
  });

  test('clears the local account replica after a remote account deletion invalidates its session', async () => {
    const storage = createMemoryStorage();
    const scopes = createDataScopeRegistry(storage);
    const clearAccountWorkspace = jest.fn().mockResolvedValue(undefined);
    let listener: ((state: { kind: 'signedOut' }) => void) | undefined;
    const view = await render(
      <AuthGate
        authGateway={{
          restoreSession: async () => ({ kind: 'authenticated', userId: 'account-17', email: 'anna@example.com' }),
          startAutonomousSession: async () => ({ kind: 'autonomous', userId: null }),
          subscribe: (next) => { listener = next as (state: { kind: 'signedOut' }) => void; return () => {}; },
        }}
        clearAccountWorkspace={clearAccountWorkspace}
        entryState={createAuthEntryState(storage)}
        scopeRegistry={scopes}>
        <Text>Основной экран</Text>
      </AuthGate>,
    );

    await waitFor(() => expect(view.getByText('Основной экран')).toBeOnTheScreen());
    listener?.({ kind: 'signedOut' });

    await waitFor(() => expect(clearAccountWorkspace).toHaveBeenCalledWith({ kind: 'account', accountId: 'account-17' }));
    await waitFor(() => expect(view.getByText('Создать аккаунт')).toBeOnTheScreen());
  });
});

function SignOutProbe() {
  const navigation = useAuthGateNavigation();
  return <Pressable accessibilityLabel="Выйти из аккаунта" onPress={() => { void navigation?.signOut(); }} />;
}

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
