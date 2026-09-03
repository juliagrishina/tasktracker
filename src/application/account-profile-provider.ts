import { createAccountProfileCache } from '../data/account-profile-cache';
import { authSessionStorage } from '../data/auth-session-storage';
import { supabase } from '../data/supabase-client';
import {
  createSupabaseAccountProfileGateway,
  type SupabaseAccountProfileClient,
} from '../data/supabase-account-profile';

import {
  createAccountProfileService,
  type AccountProfileService,
} from './account-profile';

export const accountProfileGateway = createSupabaseAccountProfileGateway(
  supabase as unknown as SupabaseAccountProfileClient | null,
);

export async function createCurrentAccountProfileService(): Promise<AccountProfileService | null> {
  const profile = await accountProfileGateway.getProfile();
  if (profile === null) return null;
  return createAccountProfileService({
    cache: createAccountProfileCache({ storage: authSessionStorage, userId: profile.userId }),
    gateway: accountProfileGateway,
  });
}
