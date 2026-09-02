import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AuthGate } from '../../src/application/auth-gate';
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
