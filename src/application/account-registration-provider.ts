import { pendingRegistrationStore } from '../data/pending-registration-store-provider';
import { createSupabaseAccountRegistrationGateway, type SupabaseAccountRegistrationClient } from '../data/supabase-account-registration';
import { supabase } from '../data/supabase-client';

import { createAccountRegistration } from './account-registration';

export const accountRegistration = createAccountRegistration({
  gateway: createSupabaseAccountRegistrationGateway(
    supabase as unknown as SupabaseAccountRegistrationClient | null,
  ),
  store: pendingRegistrationStore,
});
