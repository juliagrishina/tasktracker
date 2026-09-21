-- Epic 11 / Task 24: clearing account data starts a new sync generation.
-- The authenticated identity, profile and mandatory legal acceptance remain.

create or replace function public.clear_account_business_data(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare next_generation bigint;
begin
  delete from public.sync_changes where user_id = p_user_id;
  delete from public.sync_mutations where user_id = p_user_id;
  delete from public.recurrence_revisions where user_id = p_user_id;
  delete from public.recurrence_occurrences where user_id = p_user_id;
  delete from public.recurrence_series where user_id = p_user_id;
  delete from public.schedule_blocks where user_id = p_user_id;
  delete from public.transfer_history where user_id = p_user_id;
  delete from public.reminders where user_id = p_user_id;
  delete from public.task_items where user_id = p_user_id;
  delete from public.projects where user_id = p_user_id;
  delete from public.daily_energy_entries where user_id = p_user_id;
  delete from public.user_settings where user_id = p_user_id;
  delete from public.user_devices where user_id = p_user_id;
  delete from public.events where user_id = p_user_id;
  delete from public.privacy_preferences where user_id = p_user_id;

  update public.account_state
  set data_generation = data_generation + 1
  where user_id = p_user_id
  returning data_generation into next_generation;

  if next_generation is null then
    raise exception 'Account state was not found.' using errcode = 'P0002';
  end if;

  update public.profiles set data_generation = next_generation where id = p_user_id;
  return next_generation;
end;
$$;

revoke all on function public.clear_account_business_data(uuid) from public;
