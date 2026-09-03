import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
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
import { createDataSource } from '../data/data-source';
import { designTokens } from '../ui/design/tokens';
import { AuthScreen } from '../ui/auth/auth-screen';
import { EmailVerificationScreen } from '../ui/auth/email-verification-screen';
import { PasswordRecoveryScreen } from '../ui/auth/password-recovery-screen';
import { WorkspaceTransferChoice } from '../ui/auth/workspace-transfer-choice';
import {
  accountRegistration as defaultAccountRegistration,
} from './account-registration-provider';
import type { AccountRegistration } from './account-registration';
import { passwordManagement as defaultPasswordManagement } from './password-management-provider';
import type { PasswordManagement, PasswordManagementResult } from './password-management';
import { validateAccountRegistrationInput } from './account-registration';
import {
  createWorkspaceTransferService,
  type WorkspaceTransferService,
} from './workspace-import';

interface AutonomousAuthGateway extends AuthGateway {
  startAutonomousSession(): Promise<AuthSessionState>;
  signInWithPassword?(input: { email: string; password: string }): Promise<AuthSessionState>;
}

interface AuthGateProps {
  children: ReactNode;
  authGateway?: AutonomousAuthGateway;
  entryState?: AuthEntryState;
  scopeRegistry?: DataScopeRegistry;
  registration?: AccountRegistration;
  passwordManagement?: PasswordManagement;
  workspaceTransfer?: WorkspaceTransferService;
}

type GateState = 'loading' | 'auth' | 'verification' | 'passwordRecovery' | 'workspaceTransfer' | 'app';
type AuthScreenMode = 'registration' | 'login';

interface AuthGateNavigation {
  openAuth(mode: AuthScreenMode): void;
}

const AuthGateNavigationContext = createContext<AuthGateNavigation | null>(null);

export function useAuthGateNavigation(): AuthGateNavigation | null {
  return useContext(AuthGateNavigationContext);
}

export function AuthGate({
  children,
  authGateway: gateway = authGateway as SupabaseAuthGateway,
  entryState = authEntryState,
  scopeRegistry = localDataScopeRegistry,
  registration = defaultAccountRegistration,
  passwordManagement = defaultPasswordManagement,
  workspaceTransfer = createWorkspaceTransferService({ sourceForScope: createDataSource }),
}: AuthGateProps) {
  const [gateState, setGateState] = useState<GateState>('loading');
  const [authScreenMode, setAuthScreenMode] = useState<AuthScreenMode>('registration');
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationInfo, setVerificationInfo] = useState<string | null>(null);
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendAvailableAtMs, setResendAvailableAtMs] = useState(0);
  const [signedInAccountId, setSignedInAccountId] = useState<string | null>(null);
  const [workspaceTransferError, setWorkspaceTransferError] = useState<string | null>(null);
  const [passwordRecoveryEmail, setPasswordRecoveryEmail] = useState<string | null>(null);
  const [passwordRecoveryError, setPasswordRecoveryError] = useState<string | null>(null);
  const [passwordRecoveryInfo, setPasswordRecoveryInfo] = useState<string | null>(null);

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

  const openAuth = (mode: AuthScreenMode) => {
    setAuthScreenMode(mode);
    setRegistrationError(null);
    setSignInError(null);
    setGateState('auth');
  };

  const openAccount = async (accountId: string) => {
    await scopeRegistry.openAccountScope(accountId);
    setSignedInAccountId(null);
    setWorkspaceTransferError(null);
    setGateState('app');
  };

  const signIn = async (input: { email: string; password: string }) => {
    setSignInError(null);
    if (gateway.signInWithPassword === undefined || input.email.trim() === '' || input.password === '') {
      setSignInError('Введите email и пароль.');
      return;
    }
    try {
      const session = await gateway.signInWithPassword({ email: input.email.trim(), password: input.password });
      if (session.kind !== 'authenticated') {
        setSignInError('Не удалось войти. Проверьте email и пароль.');
        return;
      }
      if (await workspaceTransfer.hasAutonomousData()) {
        setSignedInAccountId(session.userId);
        setWorkspaceTransferError(null);
        setGateState('workspaceTransfer');
        return;
      }
      await openAccount(session.userId);
    } catch {
      setSignInError('Не удалось войти. Проверьте email и пароль.');
    }
  };

  const mergeAutonomousWorkspace = async () => {
    if (signedInAccountId === null) return;
    setWorkspaceTransferError(null);
    try {
      await workspaceTransfer.importIntoAccount(signedInAccountId);
      await openAccount(signedInAccountId);
    } catch {
      setWorkspaceTransferError('Не удалось перенести данные. Исходные планы сохранены — попробуйте ещё раз.');
    }
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

  const requestPasswordRecovery = async ({ email }: { email: string }) => {
    setPasswordRecoveryError(null);
    setPasswordRecoveryInfo(null);
    const result = await passwordManagement.requestPasswordRecovery(email);
    if (result.kind === 'recoveryRequested') {
      setPasswordRecoveryEmail(email.trim());
      setPasswordRecoveryInfo('Если такой аккаунт существует, код отправлен.');
      return;
    }
    setPasswordRecoveryError(messageForPasswordResult(result));
  };

  const resendPasswordRecovery = async () => {
    setPasswordRecoveryError(null);
    setPasswordRecoveryInfo(null);
    const result = await passwordManagement.resendPasswordRecoveryCode();
    if (result.kind === 'recoveryRequested') {
      setPasswordRecoveryInfo('Если такой аккаунт существует, новый код отправлен.');
      return;
    }
    setPasswordRecoveryError(messageForPasswordResult(result));
  };

  const completePasswordRecovery = async (input: { email: string; code: string; password: string; passwordConfirmation: string }) => {
    setPasswordRecoveryError(null);
    setPasswordRecoveryInfo(null);
    const result = await passwordManagement.completePasswordRecovery(input);
    if (result.kind !== 'passwordRecovered') {
      setPasswordRecoveryError(messageForPasswordResult(result));
      return;
    }
    const session = await gateway.restoreSession();
    if (session.kind !== 'authenticated') {
      setPasswordRecoveryError('Не удалось открыть обновлённый аккаунт. Войдите с новым паролем.');
      return;
    }
    await openAccount(session.userId);
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
        initialMode={authScreenMode}
        onContinueWithoutAccount={() => {
          void continueWithoutAccount();
        }}
        onSignUp={(input) => {
          void startRegistration(input);
        }}
        onSignIn={(input) => {
          void signIn(input);
        }}
        onForgotPassword={() => {
          setPasswordRecoveryEmail(null);
          setPasswordRecoveryError(null);
          setPasswordRecoveryInfo(null);
          setGateState('passwordRecovery');
        }}
        registrationError={registrationError}
        signInError={signInError}
      />
    );
  }

  if (gateState === 'workspaceTransfer' && signedInAccountId !== null) {
    return (
      <WorkspaceTransferChoice
        errorMessage={workspaceTransferError}
        onMerge={() => {
          void mergeAutonomousWorkspace();
        }}
        onKeepSeparate={() => {
          void openAccount(signedInAccountId);
        }}
      />
    );
  }

  if (gateState === 'passwordRecovery') {
    return <PasswordRecoveryScreen
      email={passwordRecoveryEmail}
      errorMessage={passwordRecoveryError}
      infoMessage={passwordRecoveryInfo}
      onBack={() => {
        setAuthScreenMode('login');
        setGateState('auth');
      }}
      onConfirm={(input) => {
        void completePasswordRecovery(input);
      }}
      onRequest={(input) => {
        void requestPasswordRecovery(input);
      }}
      onResend={() => {
        void resendPasswordRecovery();
      }}
    />;
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

  return <AuthGateNavigationContext.Provider value={{ openAuth }}>{children}</AuthGateNavigationContext.Provider>;
}

function messageForPasswordResult(result: PasswordManagementResult): string {
  switch (result.kind) {
    case 'codeSent':
    case 'passwordChanged':
    case 'recoveryRequested':
    case 'passwordRecovered':
      return 'Операция завершена.';
    case 'validationError':
    case 'requestFailed':
      return result.message;
    case 'resendCooldown':
      return 'Новый код можно запросить через минуту.';
    case 'missingCodeRequest':
      return 'Сначала запросите новый код.';
    case 'expiredCode':
      return 'Срок действия кода истёк. Отправьте новый код.';
    case 'codeInvalidated':
      return 'Код аннулирован. Отправьте новый код.';
    case 'incorrectCode':
      return `Неверный код. Осталось попыток: ${result.attemptsRemaining}.`;
  }
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
