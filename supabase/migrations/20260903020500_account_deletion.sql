alter table public.profiles add column if not exists data_generation bigint not null default 1;

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  status text not null check (status in ('processing', 'retry_required', 'completed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text
);
alter table public.deletion_requests enable row level security;
revoke all on public.deletion_requests from anon, authenticated;

-- A deletion request deliberately does not reference auth.users.  Its terminal
-- record must survive the Auth-user cascade so an interrupted client request
-- cannot make an already deleted account look usable again.
create or replace function public.account_deletion_is_pending(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deletion_requests
    where user_id = p_user_id
      and status in ('processing', 'retry_required')
  );
$$;

-- The operation first records its durable state.  All browser-side writes to
-- cloud user data are then rejected, including while a safe retry is pending.
drop policy if exists "events_block_account_deletion" on public.events;
create policy "events_block_account_deletion" on public.events
  as restrictive
  for all
  to authenticated
  using (not public.account_deletion_is_pending(auth.uid()))
  with check (not public.account_deletion_is_pending(auth.uid()));

drop policy if exists "legal_acceptances_block_account_deletion" on public.legal_acceptances;
create policy "legal_acceptances_block_account_deletion" on public.legal_acceptances
  as restrictive
  for all
  to authenticated
  using (not public.account_deletion_is_pending(auth.uid()))
  with check (not public.account_deletion_is_pending(auth.uid()));

drop policy if exists "privacy_preferences_block_account_deletion" on public.privacy_preferences;
create policy "privacy_preferences_block_account_deletion" on public.privacy_preferences
  as restrictive
  for all
  to authenticated
  using (not public.account_deletion_is_pending(auth.uid()))
  with check (not public.account_deletion_is_pending(auth.uid()));

-- Service-only RPCs keep all account-owned table changes in one PostgreSQL
-- transaction.  Stage A has no synced planner tables yet; when sync lands,
-- its user-owned tables are added here rather than cleared piecemeal in Edge.
create or replace function public.clear_account_business_data(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_generation bigint;
begin
  delete from public.events where user_id = p_user_id;
  delete from public.legal_acceptances where user_id = p_user_id;
  delete from public.privacy_preferences where user_id = p_user_id;

  update public.profiles
  set data_generation = data_generation + 1
  where id = p_user_id
  returning data_generation into next_generation;

  if next_generation is null then
    raise exception 'Account profile was not found.' using errcode = 'P0002';
  end if;

  return next_generation;
end;
$$;

revoke all on function public.account_deletion_is_pending(uuid) from public;
grant execute on function public.account_deletion_is_pending(uuid) to authenticated;
revoke all on function public.clear_account_business_data(uuid) from public;
