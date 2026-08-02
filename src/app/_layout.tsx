import { Stack } from 'expo-router';

import { AppServicesProvider } from '../application/app-services-provider';

export default function RootLayout() {
  return (
    <AppServicesProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AppServicesProvider>
  );
}
