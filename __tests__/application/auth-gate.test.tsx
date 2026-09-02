import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AuthGate } from '../../src/application/auth-gate';
import { createAccountRegistration, createMemoryPendingRegistrationStore } from '../../src/application/account-registration';
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
});

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
