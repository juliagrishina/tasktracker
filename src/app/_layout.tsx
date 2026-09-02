import { Stack } from 'expo-router';

import { AuthGate } from '../application/auth-gate';
import { AppServicesProvider } from '../application/app-services-provider';

export default function RootLayout() {
  return (
    <AuthGate>
      <AppServicesProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AppServicesProvider>
    </AuthGate>
  );
}
