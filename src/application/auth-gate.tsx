import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  authGateway,
  type AuthGateway,
  type AuthSessionState,
  type SupabaseAuthGateway,
} from '../data/auth-session';
import type { AuthEntryState } from '../data/auth-entry-state';
import { authEntryState } from '../data/auth-entry-state-provider';
import { localDataScopeRegistry } from '../data/local-data-scope-registry';
import type { DataScopeRegistry } from '../data/local-data-scopes';
import { designTokens } from '../ui/design/tokens';
import { AuthScreen } from '../ui/auth/auth-screen';

interface AutonomousAuthGateway extends AuthGateway {
  startAutonomousSession(): Promise<AuthSessionState>;
}

interface AuthGateProps {
  children: ReactNode;
  authGateway?: AutonomousAuthGateway;
  entryState?: AuthEntryState;
  scopeRegistry?: DataScopeRegistry;
}

type GateState = 'loading' | 'auth' | 'app';

export function AuthGate({
  children,
  authGateway: gateway = authGateway as SupabaseAuthGateway,
  entryState = authEntryState,
  scopeRegistry = localDataScopeRegistry,
}: AuthGateProps) {
  const [gateState, setGateState] = useState<GateState>('loading');

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const session = await gateway.restoreSession();
        const shouldOpenApp = await entryState.shouldOpenApp(session);
        if (isMounted) {
          setGateState(shouldOpenApp ? 'app' : 'auth');
        }
      } catch {
        if (isMounted) {
          setGateState('auth');
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [entryState, gateway]);

  const continueWithoutAccount = async () => {
    try {
      await gateway.startAutonomousSession();
    } catch {
      // Локальная автономная область доступна и без сети/Supabase.
    }
    await scopeRegistry.openAutonomousScope();
    await entryState.continueWithoutAccount();
    setGateState('app');
  };

  if (gateState === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={designTokens.color.primary} />
      </View>
    );
  }

  if (gateState === 'auth') {
    return (
      <AuthScreen
        onContinueWithoutAccount={() => {
          void continueWithoutAccount();
        }}
      />
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: designTokens.color.surface.canvas,
  },
});
