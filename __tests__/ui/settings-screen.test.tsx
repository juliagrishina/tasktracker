import { render, waitFor } from '@testing-library/react-native';

import SettingsScreen from '../../src/app/(tabs)/settings';

const mockService = {
  loadCached: jest.fn().mockResolvedValue({
    kind: 'authenticated',
    displayName: 'Юлия Гришина',
    email: 'julia@example.com',
    emailConfirmed: true,
    pendingEmail: null,
  }),
  refresh: jest.fn().mockResolvedValue({
    kind: 'authenticated',
    displayName: 'Юлия Гришина',
    email: 'julia@example.com',
    emailConfirmed: true,
    pendingEmail: null,
  }),
};

jest.mock('../../src/application/app-services-provider', () => ({
  useAppServices: () => ({
    clearAccountData: jest.fn(),
    clearAutonomousData: jest.fn(),
    resolveAccountSyncConflict: jest.fn(),
    settings: {},
    settingsActions: { updatePlanningSettings: jest.fn(), updateTimeZone: jest.fn(), useDeviceTimeZone: jest.fn() },
    syncAccountData: jest.fn(),
    syncConflicts: [],
    syncStatus: { kind: 'synchronized', pendingCount: 0, lastSuccessAt: null },
  }),
}));

jest.mock('../../src/application/auth-gate', () => ({
  useAuthGateNavigation: () => null,
  useAuthGateWorkspace: () => ({ kind: 'account', accountId: 'user-17' }),
}));

jest.mock('../../src/application/account-profile-provider', () => ({
  createAccountProfileServiceForUser: () => mockService,
}));

jest.mock('../../src/application/password-management-provider', () => ({ passwordManagement: {} }));
jest.mock('../../src/application/account-data-actions-provider', () => ({ performAccountDataAction: jest.fn() }));
jest.mock('../../src/application/notification-permission-gateway', () => ({ notificationPermissionGateway: {} }));

jest.mock('../../src/ui/settings/settings-state-panel', () => {
  const { Text: MockText } = require('react-native');
  return {
    SettingsStatePanel: ({ account }: { account: { kind: string; displayName?: string; email?: string } }) => (
      <MockText>{account.kind === 'authenticated' ? `${account.displayName} ${account.email}` : 'Без аккаунта'}</MockText>
    ),
  };
});

describe('SettingsScreen', () => {
  test('keeps cached account identity while its profile refresh runs', async () => {
    const view = await render(<SettingsScreen />);

    await waitFor(() => expect(view.getByText('Юлия Гришина julia@example.com')).toBeOnTheScreen());
    expect(view.queryByText('Без аккаунта')).toBeNull();
    expect(mockService.loadCached).toHaveBeenCalled();
  });
});
