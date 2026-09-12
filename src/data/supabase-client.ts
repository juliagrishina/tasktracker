import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';
import { createClient, processLock } from '@supabase/supabase-js';
import { authSessionStorage } from './auth-session-storage';

const runtimePublicConfig = Constants.expoConfig?.extra as {
  publicSupabaseUrl?: unknown;
  publicSupabasePublishableKey?: unknown;
} | undefined;
const supabaseUrl = publicConfigurationValue(process.env.EXPO_PUBLIC_SUPABASE_URL, runtimePublicConfig?.publicSupabaseUrl);
const supabasePublishableKey = publicConfigurationValue(
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  runtimePublicConfig?.publicSupabasePublishableKey,
);

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        storage: authSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    })
  : null;

/**
 * Verifies the current password without replacing the app's persisted session.
 * The temporary session is explicitly revoked by the password-management gateway.
 */
export function createTransientSupabaseAuthClient() {
  if (!supabaseUrl || !supabasePublishableKey) return null;
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

if (Platform.OS !== 'web' && supabase !== null) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

function publicConfigurationValue(buildTimeValue: string | undefined, runtimeValue: unknown): string | undefined {
  if (typeof buildTimeValue === 'string' && buildTimeValue !== '') return buildTimeValue;
  return typeof runtimeValue === 'string' && runtimeValue !== '' ? runtimeValue : undefined;
}
