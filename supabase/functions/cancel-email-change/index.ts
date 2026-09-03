import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const supabaseUrl = requireEnvironment('SUPABASE_URL');
const supabaseAnonKey = requireEnvironment('SUPABASE_ANON_KEY');
Deno.serve(async (request) => {
  const token = bearerToken(request.headers.get('Authorization'));
  if (token === null) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError !== null || user === null) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (user.email === null || user.new_email === undefined || user.new_email === '') {
    return Response.json({ error: 'No pending email change.' }, { status: 409 });
  }

  // The database function obtains auth.uid() from the same verified bearer
  // token and clears only the caller's pending email-change fields and OTP.
  const { data: cancelled, error: cancellationError } = await userClient.rpc('cancel_pending_email_change');
  if (cancellationError !== null || cancelled !== true) {
    return Response.json({ error: 'Could not cancel the email change.' }, { status: 500 });
  }

  return Response.json({ cancelled: true });
});

function bearerToken(header: string | null): string | null {
  if (header === null) return null;
  const match = /^Bearer\s+(.+)$/iu.exec(header);
  return match?.[1] ?? null;
}

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === '') throw new Error(`${name} is required.`);
  return value;
}
