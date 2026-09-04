import { supabase } from '../data/supabase-client';

export type AccountDataOperation = 'clear_account_data' | 'delete_account';
export type AccountDataActionResult = { kind: 'cleared'; dataGeneration: number } | { kind: 'deleted' } | { kind: 'failed' };

export async function performAccountDataAction(input: { operation: AccountDataOperation; password: string; code: string }): Promise<AccountDataActionResult> {
  if (supabase === null) return { kind: 'failed' };
  const { data, error } = await supabase.functions.invoke('account-data-action', { body: input });
  if (error !== null || data === null || typeof data !== 'object' || Array.isArray(data)) return { kind: 'failed' };
  if (input.operation === 'clear_account_data') {
    const dataGeneration = (data as { dataGeneration?: unknown }).dataGeneration;
    return typeof dataGeneration === 'number' && Number.isSafeInteger(dataGeneration) && dataGeneration > 0
      ? { kind: 'cleared', dataGeneration }
      : { kind: 'failed' };
  }
  return (data as { deleted?: unknown }).deleted === true ? { kind: 'deleted' } : { kind: 'failed' };
}
