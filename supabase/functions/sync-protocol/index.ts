import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const url = required('SUPABASE_URL');
const anonKey = required('SUPABASE_ANON_KEY');
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
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error !== null || user === null || user.is_anonymous || user.email === null) return respond({ error: 'Unauthorized.' }, 401);
  const body = await request.json().catch(() => null) as { mutations?: unknown; cursor?: unknown; limit?: unknown; bootstrap?: unknown } | null;
  if (body === null) return respond({ error: 'Invalid request.' }, 400);

  if (body.mutations !== undefined) {
    if (!Array.isArray(body.mutations)) return respond({ error: 'Invalid mutations.' }, 400);
    const mutations: unknown[] = [];
    const conflicts: unknown[] = [];
    for (const mutation of body.mutations) {
      const { data, error: applyError } = await userClient.rpc('apply_sync_mutations', { p_mutations: [mutation] });
      if (applyError === null) {
        if (Array.isArray(data)) mutations.push(...data);
        continue;
      }
      if (applyError.message.includes('Invalid or stale sync mutation.')) return respond({ error: 'Sync mutation was rejected.', code: 'stale_generation' }, 409);
      if (!applyError.message.includes('Sync version conflict.') || mutation === null || typeof mutation !== 'object' || Array.isArray(mutation)) {
        return respond({ error: 'Sync mutation was rejected.', code: 'sync_rejected' }, 409);
      }
      const candidate = mutation as { entityType?: unknown; entityId?: unknown };
      if (typeof candidate.entityType !== 'string' || typeof candidate.entityId !== 'string') return respond({ error: 'Invalid mutations.' }, 400);
      const { data: server, error: snapshotError } = await userClient.rpc('get_sync_conflict_snapshot', { p_entity_type: candidate.entityType, p_entity_id: candidate.entityId });
      if (snapshotError !== null || server === null) return respond({ error: 'Sync conflict could not be read.', code: 'sync_rejected' }, 409);
      conflicts.push({ local: mutation, server });
    }
    return respond({ mutations, conflicts });
  }

  if (body.bootstrap === true) {
    const { data, error: bootstrapError } = await userClient.rpc('get_sync_data_generation');
    if (bootstrapError !== null || typeof data !== 'number') return respond({ error: 'Sync bootstrap was rejected.' }, 409);
    return respond({ dataGeneration: data });
  }

  const cursor = typeof body.cursor === 'number' && Number.isSafeInteger(body.cursor) ? body.cursor : 0;
  const limit = typeof body.limit === 'number' && Number.isSafeInteger(body.limit) ? body.limit : 100;
  const { data, error: pullError } = await userClient.rpc('pull_sync_changes', { p_cursor: cursor, p_limit: limit });
  if (pullError !== null) return respond({ error: 'Sync pull was rejected.' }, 409);
  return respond({ changes: data });
});

function respond(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
