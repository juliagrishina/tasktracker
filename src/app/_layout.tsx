import { Stack } from 'expo-router';

import { AuthGate, useAuthGateWorkspace } from '../application/auth-gate';
import { AppServicesProvider, useAppServices } from '../application/app-services-provider';
import { AppBootScreen } from '../ui/primitives/app-boot-screen';

export default function RootLayout() {
  return (
    <AuthGate>
      <ScopedAppServices />
    </AuthGate>
  );
}

function ScopedAppServices() {
  const scope = useAuthGateWorkspace();
  const scopeKey = scope.kind === 'account' ? `account:${scope.accountId}` : 'autonomous';
  return <AppServicesProvider key={scopeKey} scope={scope}>
    <AppNavigator />
  </AppServicesProvider>;
}

function AppNavigator() {
  const { bootStatus, isReady } = useAppServices();

  if (!isReady) return <AppBootScreen {...bootStatus} />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
