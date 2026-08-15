import { supabase } from './supabase-client';

/**
 * Ensures a Supabase identity exists for this device before any cloud
 * write (e.g. event recording) is attempted. No registration UI is
 * involved: an anonymous auth.users row is created on first launch and
 * persisted by the Supabase client's AsyncStorage-backed session storage.
 */
export async function ensureAnonymousSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();

  if (data.session !== null) {
    return;
  }

  const { error } = await supabase.auth.signInAnonymously();

  if (error !== null) {
    throw error;
  }
}
