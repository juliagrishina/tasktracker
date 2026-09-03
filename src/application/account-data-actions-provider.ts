import { supabase } from '../data/supabase-client';

export type AccountDataOperation = 'clear_account_data' | 'delete_account';
export async function performAccountDataAction(input: { operation: AccountDataOperation; password: string; code: string }): Promise<boolean> {
  if (supabase === null) return false;
  const { error } = await supabase.functions.invoke('account-data-action', { body: input });
  return error === null;
}
