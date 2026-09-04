-- Epic 11 / Task 20: a stale local replica must obtain the current generation
-- before discarding its old outbox and restarting from cursor zero.
create or replace function public.get_sync_data_generation()
returns bigint
language sql
security definer
set search_path = public
as $$
  select data_generation
  from public.account_state
  where user_id = public.sync_require_account_owner();
$$;

revoke all on function public.get_sync_data_generation() from public;
grant execute on function public.get_sync_data_generation() to authenticated;
