import { createPasswordManagement } from './password-management';
import {
  createSupabasePasswordManagementGateway,
  type SupabasePasswordManagementClient,
  type SupabasePasswordVerifier,
} from '../data/supabase-password-management';
import { createTransientSupabaseAuthClient, supabase } from '../data/supabase-client';

export const passwordManagement = createPasswordManagement({
  gateway: createSupabasePasswordManagementGateway(
    supabase as unknown as SupabasePasswordManagementClient | null,
    createTransientSupabaseAuthClient() as unknown as SupabasePasswordVerifier | null,
  ),
});
