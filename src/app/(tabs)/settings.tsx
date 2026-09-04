import { useCallback, useEffect, useState } from 'react';

import { type AccountProfileResult, type AccountProfileService, type AccountProfileState } from '../../application/account-profile';
import { createCurrentAccountProfileService } from '../../application/account-profile-provider';
import { passwordManagement } from '../../application/password-management-provider';
import { performAccountDataAction } from '../../application/account-data-actions-provider';
import { useAppServices } from '../../application/app-services-provider';
import { useAuthGateNavigation } from '../../application/auth-gate';
import { notificationPermissionGateway } from '../../application/notification-permission-gateway';
import { SettingsStatePanel } from '../../ui/settings/settings-state-panel';

export default function SettingsScreen() {
  const { clearAccountData, clearAutonomousData, settings, settingsActions, syncAccountData, syncConflicts, resolveAccountSyncConflict } = useAppServices();
  const authNavigation = useAuthGateNavigation();
  const [account, setAccount] = useState<AccountProfileState>({ kind: 'withoutAccount' });
  const [accountService, setAccountService] = useState<AccountProfileService | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const service = await createCurrentAccountProfileService();
        if (!mounted) return;
        setAccountService(service);
        setAccount(service === null ? { kind: 'withoutAccount' } : await service.load());
      } catch {
        if (mounted) setAccount({ kind: 'withoutAccount' });
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const runAccountAction = useCallback(async (action: (service: AccountProfileService) => Promise<AccountProfileResult>): Promise<AccountProfileResult> => {
    if (accountService === null) {
      return { kind: 'requestFailed', message: 'Войдите в аккаунт, чтобы изменить данные.' };
    }
    const result = await action(accountService);
    if (result.kind !== 'requestFailed' && result.kind !== 'validationError') {
      setAccount(await accountService.load());
    }
    return result;
  }, [accountService]);

  return <SettingsStatePanel
    account={account}
    notificationPermissions={notificationPermissionGateway}
    onAccountCancelEmailChange={() => runAccountAction((service) => service.cancelEmailChange())}
    onChangePassword={(input) => passwordManagement.changePassword(input)}
    onAccountConfirmEmailChange={(input) => runAccountAction((service) => service.confirmEmailChange(input))}
    onAccountStartEmailChange={(input) => runAccountAction((service) => service.startEmailChange(input))}
    onAccountUpdateDisplayName={(displayName) => runAccountAction((service) => service.updateDisplayName(displayName))}
    onClearAutonomousData={clearAutonomousData}
    onAccountDataAction={async (input) => { const completed = await performAccountDataAction(input); if (completed) await clearAccountData(); if (completed && input.operation === 'delete_account') await authNavigation?.signOut(); return completed; }}
    onRequestAccountDataCode={() => passwordManagement.requestPasswordChangeCode()}
    onPlanningSettingsChange={settingsActions.updatePlanningSettings}
    onRequestPasswordChangeCode={() => passwordManagement.requestPasswordChangeCode()}
    onSignIn={() => authNavigation?.openAuth('login')}
    onSignOut={() => { void authNavigation?.signOut(); }}
    onSignUp={() => authNavigation?.openAuth('registration')}
    onSyncAccountData={syncAccountData}
    syncConflicts={syncConflicts}
    onResolveSyncConflict={resolveAccountSyncConflict}
    onTimeZoneChange={settingsActions.updateTimeZone}
    onUseDeviceTimeZone={settingsActions.useDeviceTimeZone}
    settings={settings}
  />;
}
