-- Epic 11 / Task 21: return the current authoritative version for an
-- optimistic-lock conflict.  This RPC is owner-scoped and deliberately never
-- exposes another user's rows.
create or replace function public.get_sync_conflict_snapshot(
  p_entity_type text,
  p_entity_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := public.sync_require_account_owner();
  snapshot jsonb;
begin
  if p_entity_type = 'daily_energy_entries' then
    select jsonb_build_object(
      'operation', case when row.deleted_at is null then 'upsert' else 'delete' end,
      'version', row.version,
      'payload', to_jsonb(row),
      'changed_at', row.updated_at,
      'device_id', null
    ) into snapshot
    from public.daily_energy_entries as row
    where row.user_id = owner_id and row.recorded_on = p_entity_id::date;
  elsif p_entity_type = 'user_settings' then
    select jsonb_build_object(
      'operation', case when row.deleted_at is null then 'upsert' else 'delete' end,
      'version', row.version,
      'payload', to_jsonb(row),
      'changed_at', row.updated_at,
      'device_id', null
    ) into snapshot
    from public.user_settings as row
    where row.user_id = owner_id;
  elsif p_entity_type in (
    'projects', 'task_items', 'reminders', 'schedule_blocks',
    'recurrence_series', 'recurrence_occurrences', 'recurrence_revisions',
    'transfer_history'
  ) then
    execute format(
      'select jsonb_build_object(''operation'', case when row.deleted_at is null then ''upsert'' else ''delete'' end, ''version'', row.version, ''payload'', to_jsonb(row), ''changed_at'', row.updated_at, ''device_id'', null) from public.%I as row where row.user_id = $1 and row.id = $2::uuid',
      p_entity_type
    ) into snapshot using owner_id, p_entity_id;
  else
    raise exception 'Unsupported sync entity type.' using errcode = '22023';
  end if;

  if snapshot is null then
    raise exception 'Sync entity was not found.' using errcode = 'P0002';
  end if;
  return snapshot;
end;
$$;

revoke all on function public.get_sync_conflict_snapshot(text, text) from public;
grant execute on function public.get_sync_conflict_snapshot(text, text) to authenticated;
