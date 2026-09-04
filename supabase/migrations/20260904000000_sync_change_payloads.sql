-- Epic 11 / Task 19: sync_changes stays a metadata-only cursor log.
-- The payload is read from the current authoritative row while serving a pull.
create or replace function public.sync_change_payload(
  p_user_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_changed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare payload jsonb;
begin
  if p_entity_type = 'daily_energy_entries' then
    select to_jsonb(row) into payload from public.daily_energy_entries as row
      where row.user_id = p_user_id and row.recorded_on = p_entity_id::date;
  elsif p_entity_type = 'user_settings' then
    select to_jsonb(row) into payload from public.user_settings as row
      where row.user_id = p_user_id;
  else
    execute format(
      'select to_jsonb(row) from public.%I as row where row.user_id = $1 and row.id = $2::uuid',
      p_entity_type
    ) into payload using p_user_id, p_entity_id;
  end if;

  return coalesce(payload, jsonb_build_object('id', p_entity_id, 'deleted_at', p_changed_at));
end;
$$;

create or replace function public.pull_sync_changes(p_cursor bigint default 0, p_limit integer default 100)
returns table(change_cursor bigint, entity_type text, entity_id text, operation text, version bigint, changed_at timestamptz, payload jsonb)
language sql
security definer
set search_path = public
as $$
  select
    change.change_cursor,
    change.entity_type,
    change.entity_id,
    change.operation,
    change.version,
    change.changed_at,
    public.sync_change_payload(change.user_id, change.entity_type, change.entity_id, change.changed_at)
  from public.sync_changes as change
  where change.user_id = public.sync_require_account_owner()
    and change.change_cursor > greatest(coalesce(p_cursor, 0), 0)
  order by change.change_cursor asc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

revoke all on function public.sync_change_payload(uuid, text, text, timestamptz) from public;

do $$
begin
  alter publication supabase_realtime add table public.sync_changes;
exception when duplicate_object then null;
end;

create policy sync_changes_realtime_owner on public.sync_changes
for select to authenticated
using (user_id = auth.uid() and not public.current_identity_is_anonymous());
