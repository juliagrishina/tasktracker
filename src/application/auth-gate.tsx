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
import { EmailVerificationScreen } from '../ui/auth/email-verification-screen';
import {
  accountRegistration as defaultAccountRegistration,
} from './account-registration-provider';
import type { AccountRegistration } from './account-registration';
import { validateAccountRegistrationInput } from './account-registration';

interface AutonomousAuthGateway extends AuthGateway {
  startAutonomousSession(): Promise<AuthSessionState>;
}

interface AuthGateProps {
  children: ReactNode;
  authGateway?: AutonomousAuthGateway;
  entryState?: AuthEntryState;
  scopeRegistry?: DataScopeRegistry;
  registration?: AccountRegistration;
}

type GateState = 'loading' | 'auth' | 'verification' | 'app';

export function AuthGate({
  children,
  authGateway: gateway = authGateway as SupabaseAuthGateway,
  entryState = authEntryState,
  scopeRegistry = localDataScopeRegistry,
  registration = defaultAccountRegistration,
}: AuthGateProps) {
  const [gateState, setGateState] = useState<GateState>('loading');
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationInfo, setVerificationInfo] = useState<string | null>(null);
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendAvailableAtMs, setResendAvailableAtMs] = useState(0);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const session = await gateway.restoreSession();
        const shouldOpenApp = await entryState.shouldOpenApp(session);
        if (isMounted) {
          if (shouldOpenApp) {
            setGateState('app');
            return;
          }
          if (session.kind === 'pendingVerification') {
            const pending = await registration.getPending();
            if (pending !== null) {
              setPendingEmail(pending.email);
              setResendAvailableAtMs(pending.resendAvailableAtMs);
              setGateState('verification');
              return;
            }
          }
          setGateState('auth');
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
  }, [entryState, gateway, registration]);

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

  const startRegistration = async (input: {
    displayName: string;
    email: string;
    password: string;
    passwordConfirmation: string;
    termsAccepted: boolean;
  }) => {
    setRegistrationError(null);
    const validationError = validateAccountRegistrationInput(input);
    if (validationError !== null) {
      setRegistrationError(validationError.message);
      return;
    }
    try {
      if ((await gateway.restoreSession()).kind === 'signedOut') {
        await gateway.startAutonomousSession();
      }
    } catch {
      setRegistrationError('Не удалось начать регистрацию без подключения к интернету.');
      return;
    }
    const result = await registration.start(input);
    if (result.kind === 'pending') {
      const pending = await registration.getPending();
      setPendingPassword(input.password);
      setPendingEmail(result.email);
      setResendAvailableAtMs(pending?.resendAvailableAtMs ?? Date.now() + 60_000);
      setGateState('verification');
      return;
    }
    setRegistrationError(result.message);
  };

  const confirmRegistration = async (input: {
    code: string;
    password: string;
    passwordConfirmation: string;
  }) => {
    setVerificationError(null);
    setVerificationInfo(null);
    const password = pendingPassword ?? input.password;
    if (pendingPassword === null && input.password !== input.passwordConfirmation) {
      setVerificationError('Пароли не совпадают.');
      return;
    }
    const result = await registration.confirm({ code: input.code, password });
    if (result.kind === 'activated') {
      await scopeRegistry.openAccountScope(result.userId);
      setPendingPassword(null);
      setGateState('app');
      return;
    }
    setVerificationError(messageForConfirmationResult(result));
  };

  const resendRegistrationCode = async () => {
    setVerificationError(null);
    setVerificationInfo(null);
    const result = await registration.resend();
    if (result.kind === 'resent') {
      const pending = await registration.getPending();
      setResendAvailableAtMs(pending?.resendAvailableAtMs ?? Date.now() + 60_000);
      setVerificationInfo('Новый код отправлен.');
      return;
    }
    if (result.kind === 'resendCooldown') {
      setResendAvailableAtMs(result.availableAtMs);
      return;
    }
    setVerificationError(result.kind === 'requestFailed' ? result.message : 'Не удалось отправить новый код.');
  };

  const continueLocallyWhileVerificationIsPending = async () => {
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
        onSignUp={(input) => {
          void startRegistration(input);
        }}
        registrationError={registrationError}
      />
    );
  }

  if (gateState === 'verification' && pendingEmail !== null) {
    return (
      <EmailVerificationScreen
        email={pendingEmail}
        errorMessage={verificationError}
        infoMessage={verificationInfo}
        onChangeEmail={() => {
          setVerificationError(null);
          setVerificationInfo(null);
          setGateState('auth');
        }}
        onConfirm={(input) => {
          void confirmRegistration(input);
        }}
        onResend={() => {
          void resendRegistrationCode();
        }}
        onContinueLocally={() => {
          void continueLocallyWhileVerificationIsPending();
        }}
        requiresPassword={pendingPassword === null}
        resendAvailableAtMs={resendAvailableAtMs}
      />
    );
  }

  return <>{children}</>;
}

function messageForConfirmationResult(
  result: Exclude<Awaited<ReturnType<AccountRegistration['confirm']>>, { kind: 'activated' }>,
): string {
  switch (result.kind) {
    case 'invalidCodeFormat':
      return 'Введите шестизначный код.';
    case 'expiredCode':
      return 'Срок действия кода истёк. Отправьте новый код.';
    case 'codeInvalidated':
      return 'Код аннулирован. Отправьте новый код.';
    case 'incorrectCode':
      return `Неверный код. Осталось попыток: ${result.attemptsRemaining}.`;
    case 'invalidPassword':
    case 'requestFailed':
      return result.message;
    case 'missingPendingRegistration':
      return 'Регистрация не найдена. Укажите email ещё раз.';
  }
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: designTokens.color.surface.canvas,
  },
});
