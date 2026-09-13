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

export function createAccountProfileServiceForUser(userId: string): AccountProfileService {
  return createAccountProfileService({
    cache: createAccountProfileCache({ storage: authSessionStorage, userId }),
    gateway: accountProfileGateway,
  });
}

export async function refreshAccountProfileCacheForUser(userId: string): Promise<void> {
  await createAccountProfileServiceForUser(userId).refresh();
}
