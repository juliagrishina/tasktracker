import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { executeAccountDeletion } from '../_shared/account-deletion.ts';
import { createActionTicketService, createHmacTicketHasher } from '../_shared/action-tickets.ts';

const url = required('SUPABASE_URL');
const anonKey = required('SUPABASE_ANON_KEY');
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
const pepper = required('ACCOUNT_ACTION_TICKET_PEPPER');
const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);
  const token = /^Bearer\s+(.+)$/iu.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (token === undefined) return respond({ error: 'Unauthorized.' }, 401);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError !== null || user === null || user.is_anonymous || user.email === null) return respond({ error: 'Unauthorized.' }, 401);
  const body = await request.json().catch(() => null) as { operation?: 'clear_account_data' | 'delete_account'; password?: string; code?: string } | null;
  if (!isAccountDataOperation(body?.operation) || !/^\d{6}$/.test(body.code ?? '') || !body.password) return respond({ error: 'Invalid request.' }, 400);

  const verifier = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const codeCheck = await verifier.auth.verifyOtp({ email: user.email, token: body.code, type: 'email' });
  if (codeCheck.error !== null) return respond({ error: 'Verification failed.' }, 403);
  const passwordCheck = await verifier.auth.signInWithPassword({ email: user.email, password: body.password });
  if (passwordCheck.error !== null) return respond({ error: 'Verification failed.' }, 403);

  const admin = createClient(url, serviceKey);
  const tickets = createActionTicketService({
    hashToken: createHmacTicketHasher(pepper),
    store: {
      insert: async (record) => { const { error } = await admin.from('account_action_tickets').insert({ user_id: record.userId, operation: record.operation, token_hash: record.tokenHash, issued_at: record.issuedAt, expires_at: record.expiresAt }); if (error) throw error; },
      consume: async ({ userId, operation, tokenHash }) => { const { data, error } = await admin.from('account_action_tickets').update({ consumed_at: new Date().toISOString() }).eq('user_id', userId).eq('operation', operation).eq('token_hash', tokenHash).is('consumed_at', null).gt('expires_at', new Date().toISOString()).select('id').maybeSingle(); if (error) throw error; return data === null ? 'invalid' : 'consumed'; },
    },
  });
  const issued = await tickets.issue({ userId: user.id, operation: body.operation });
  if ((await tickets.consume({ userId: user.id, operation: body.operation, ticket: issued.ticket })).kind !== 'consumed') return respond({ error: 'Verification failed.' }, 403);

  if (body.operation === 'clear_account_data') {
    const { error } = await admin.rpc('clear_account_business_data', { p_user_id: user.id });
    if (error !== null) return respond({ error: 'Clear is retryable.' }, 503);
    return respond({ cleared: true });
  }

  const deletion = await executeAccountDeletion({
    begin: async (userId) => (await admin.from('deletion_requests').upsert({ user_id: userId, status: 'processing', completed_at: null, last_error: null }, { onConflict: 'user_id' })).error === null,
    clearBusinessData: async (userId) => (await admin.rpc('clear_account_business_data', { p_user_id: userId })).error === null,
    deleteAuthUser: async (userId) => (await admin.auth.admin.deleteUser(userId, true)).error === null,
    markRetry: async (userId, reason) => { await admin.from('deletion_requests').update({ status: 'retry_required', last_error: reason }).eq('user_id', userId); },
    markCompleted: async (userId) => (await admin.from('deletion_requests').update({ status: 'completed', completed_at: new Date().toISOString(), last_error: null }).eq('user_id', userId)).error === null,
  }, user.id);
  if (deletion.kind === 'pending') {
    // The client clears its local replica and signs out on this 202 response.
    // A later authenticated retry is safe because the durable RLS gate remains closed.
    return respond({ deletionPending: true }, 202);
  }
  return respond({ deleted: true });
});

function isAccountDataOperation(value: unknown): value is 'clear_account_data' | 'delete_account' {
  return value === 'clear_account_data' || value === 'delete_account';
}

function respond(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

function required(name: string): string { const value = Deno.env.get(name); if (!value) throw new Error(`${name} is required.`); return value; }
