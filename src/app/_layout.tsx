import { Stack } from 'expo-router';

import { AuthGate, useAuthGateWorkspace } from '../application/auth-gate';
import { AppServicesProvider } from '../application/app-services-provider';

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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  </AppServicesProvider>;
}
