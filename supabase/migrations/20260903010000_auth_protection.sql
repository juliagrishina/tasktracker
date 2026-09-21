-- Epic 11 / Task 8: one-time server-side authorisation for destructive
-- account actions.  The raw ticket never reaches this table; only an HMAC
-- hash produced by a trusted Edge Function is persisted.

create table if not exists public.account_action_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  operation text not null check (operation in ('clear_account_data', 'delete_account')),
  token_hash text not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint account_action_tickets_expiry_after_issue check (expires_at > issued_at)
);

create index if not exists account_action_tickets_user_operation_expiry_idx
  on public.account_action_tickets (user_id, operation, expires_at);

alter table public.account_action_tickets enable row level security;

-- No browser client can read, issue, amend or consume tickets directly.
revoke all on public.account_action_tickets from anon;
revoke all on public.account_action_tickets from authenticated;

-- The consuming Edge Function calls this as the currently authenticated user.
-- The single UPDATE both validates ticket scope and marks it consumed, so a
-- replay cannot win a concurrent request.
create or replace function public.consume_account_action_ticket(
  p_operation text,
  p_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  consumed_ticket_id uuid;
begin
  if auth.uid() is null or public.current_identity_is_anonymous() then
    return false;
  end if;

  update public.account_action_tickets
  set consumed_at = now()
  where user_id = auth.uid()
    and operation = p_operation
    and token_hash = p_token_hash
    and consumed_at is null
    and expires_at > now()
  returning id into consumed_ticket_id;

  return consumed_ticket_id is not null;
end;
$$;

revoke all on function public.consume_account_action_ticket(text, text) from public;
grant execute on function public.consume_account_action_ticket(text, text) to authenticated;
