-- Epic 11 / Task 18: the sole mutation boundary for account planner data.
-- The browser may read its own rows but cannot modify tables directly.

create table public.sync_mutations (
  user_id uuid not null references auth.users (id) on delete cascade,
  mutation_id text not null,
  result jsonb not null,
  applied_at timestamptz not null default now(),
  primary key (user_id, mutation_id),
  unique (user_id, mutation_id)
);

create table public.sync_changes (
  change_cursor bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  operation text not null check (operation in ('upsert', 'delete')),
  version bigint,
  changed_at timestamptz not null default now()
);
create index sync_changes_owner_cursor on public.sync_changes (user_id, change_cursor);

alter table public.sync_mutations enable row level security;
alter table public.sync_changes enable row level security;
revoke all on table public.sync_mutations, public.sync_changes from public, anon, authenticated;

create or replace function public.sync_require_account_owner()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null
    or public.current_identity_is_anonymous()
    or public.account_deletion_is_pending(current_user_id) then
    raise exception 'Sync is unavailable for this identity.' using errcode = '42501';
  end if;
  return current_user_id;
end;
$$;

create or replace function public.sync_normalize_payload(
  p_entity_type text,
  p_entity_id text,
  p_user_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  normalized jsonb;
  repeat_rule jsonb;
begin
  select coalesce(jsonb_object_agg(
    lower(regexp_replace(key, '([A-Z])', E'_\\1', 'g')),
    value
  ), '{}'::jsonb)
  into normalized
  from jsonb_each(coalesce(p_payload, '{}'::jsonb));

  if p_entity_type = 'reminders' then
    repeat_rule := normalized -> 'repeat_rule';
    normalized := normalized - 'repeat_rule' || jsonb_build_object(
      'repeat_frequency', repeat_rule -> 'frequency',
      'repeat_interval', repeat_rule -> 'interval',
      'repeat_weekdays_json', repeat_rule -> 'weekdays'
    );
  elsif p_entity_type in ('recurrence_series', 'recurrence_revisions') then
    normalized := normalized - 'weekdays' || jsonb_build_object('weekdays_json', normalized -> 'weekdays');
  end if;

  if p_entity_type = 'recurrence_series' then
    normalized := normalized || case when normalized ->> 'item_kind' = 'task'
      then jsonb_build_object('task_series_item_id', normalized -> 'item_id', 'reminder_series_item_id', null)
      else jsonb_build_object('task_series_item_id', null, 'reminder_series_item_id', normalized -> 'item_id')
    end;
  elsif p_entity_type = 'recurrence_occurrences' then
    normalized := normalized - 'task_patch' - 'reminder_patch' || jsonb_build_object(
      'task_patch_json', normalized -> 'task_patch',
      'reminder_patch_json', normalized -> 'reminder_patch'
    );
  elsif p_entity_type = 'recurrence_revisions' then
    normalized := normalized - 'task_patch' - 'block_templates' || jsonb_build_object(
      'task_patch_json', normalized -> 'task_patch',
      'block_templates_json', normalized -> 'block_templates'
    );
  end if;

  if p_entity_type = 'daily_energy_entries' then
    normalized := normalized || jsonb_build_object('id', gen_random_uuid()::text);
  elsif p_entity_type = 'user_settings' then
    normalized := normalized || jsonb_build_object('id', gen_random_uuid()::text);
  else
    normalized := normalized || jsonb_build_object('id', p_entity_id);
  end if;

  return normalized || jsonb_build_object(
    'user_id', p_user_id::text,
    'version', 1,
    'updated_at', now()::text
  );
end;
$$;

create or replace function public.sync_apply_entity(
  p_user_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_operation text,
  p_expected_version bigint,
  p_payload jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  table_name text;
  columns_sql text;
  update_sql text;
  conflict_sql text;
  row_payload jsonb;
  applied_version bigint;
  existing_row integer;
begin
  if p_entity_type not in (
    'projects', 'task_items', 'reminders', 'schedule_blocks',
    'recurrence_series', 'recurrence_occurrences', 'recurrence_revisions',
    'transfer_history', 'daily_energy_entries', 'user_settings'
  ) then
    raise exception 'Unsupported sync entity.' using errcode = '22023';
  end if;
  if p_operation not in ('upsert', 'delete') or p_expected_version < 0 then
    raise exception 'Invalid sync mutation.' using errcode = '22023';
  end if;

  table_name := p_entity_type;
  if p_operation = 'delete' then
    if p_entity_type = 'daily_energy_entries' then
      update public.daily_energy_entries set deleted_at = now()
      where user_id = p_user_id and recorded_on = p_entity_id::date and version = p_expected_version
      returning version into applied_version;
    elsif p_entity_type = 'user_settings' then
      update public.user_settings set deleted_at = now()
      where user_id = p_user_id and version = p_expected_version
      returning version into applied_version;
    else
      execute format('update public.%I set deleted_at = now() where user_id = $1 and id = $2::uuid and version = $3 returning version', table_name)
      into applied_version using p_user_id, p_entity_id, p_expected_version;
    end if;
    return applied_version;
  end if;

  row_payload := public.sync_normalize_payload(p_entity_type, p_entity_id, p_user_id, p_payload);
  case p_entity_type
    when 'projects' then
      columns_sql := 'id, user_id, title, description, completed_at, version, created_at, updated_at, deleted_at';
      update_sql := 'title = excluded.title, description = excluded.description, completed_at = excluded.completed_at, deleted_at = excluded.deleted_at';
      conflict_sql := 'id';
    when 'task_items' then
      columns_sql := 'id, user_id, kind, project_id, parent_task_id, title, description, estimated_duration_minutes, scheduled_on, period_start_on, period_end_on, completed_at, version, created_at, updated_at, deleted_at';
      update_sql := 'kind = excluded.kind, project_id = excluded.project_id, parent_task_id = excluded.parent_task_id, title = excluded.title, description = excluded.description, estimated_duration_minutes = excluded.estimated_duration_minutes, scheduled_on = excluded.scheduled_on, period_start_on = excluded.period_start_on, period_end_on = excluded.period_end_on, completed_at = excluded.completed_at, deleted_at = excluded.deleted_at';
      conflict_sql := 'id';
    when 'reminders' then
      columns_sql := 'id, user_id, title, linked_task_item_id, linked_occurrence_on, reminds_on, period_start_on, period_end_on, repeat_frequency, repeat_interval, repeat_weekdays_json, estimated_duration_minutes, completed_at, version, created_at, updated_at, deleted_at';
      update_sql := 'title = excluded.title, linked_task_item_id = excluded.linked_task_item_id, linked_occurrence_on = excluded.linked_occurrence_on, reminds_on = excluded.reminds_on, period_start_on = excluded.period_start_on, period_end_on = excluded.period_end_on, repeat_frequency = excluded.repeat_frequency, repeat_interval = excluded.repeat_interval, repeat_weekdays_json = excluded.repeat_weekdays_json, estimated_duration_minutes = excluded.estimated_duration_minutes, completed_at = excluded.completed_at, deleted_at = excluded.deleted_at';
      conflict_sql := 'id';
    when 'schedule_blocks' then
      columns_sql := 'id, user_id, task_item_id, occurrence_id, time_zone_id, starts_at, ends_at, version, created_at, updated_at, deleted_at';
      update_sql := 'task_item_id = excluded.task_item_id, occurrence_id = excluded.occurrence_id, time_zone_id = excluded.time_zone_id, starts_at = excluded.starts_at, ends_at = excluded.ends_at, deleted_at = excluded.deleted_at';
      conflict_sql := 'id';
    when 'recurrence_series' then
      columns_sql := 'id, user_id, item_kind, item_id, task_series_item_id, reminder_series_item_id, frequency, interval, weekdays_json, starts_on, version, created_at, updated_at, deleted_at';
      update_sql := 'item_kind = excluded.item_kind, item_id = excluded.item_id, task_series_item_id = excluded.task_series_item_id, reminder_series_item_id = excluded.reminder_series_item_id, frequency = excluded.frequency, interval = excluded.interval, weekdays_json = excluded.weekdays_json, starts_on = excluded.starts_on, deleted_at = excluded.deleted_at';
      conflict_sql := 'id';
    when 'recurrence_occurrences' then
      columns_sql := 'id, user_id, series_id, occurs_on, cancelled_at, completed_at, blocks_overridden, task_patch_json, reminder_patch_json, version, created_at, updated_at, deleted_at';
      update_sql := 'series_id = excluded.series_id, occurs_on = excluded.occurs_on, cancelled_at = excluded.cancelled_at, completed_at = excluded.completed_at, blocks_overridden = excluded.blocks_overridden, task_patch_json = excluded.task_patch_json, reminder_patch_json = excluded.reminder_patch_json, deleted_at = excluded.deleted_at';
      conflict_sql := 'id';
    when 'recurrence_revisions' then
      columns_sql := 'id, user_id, series_id, effective_from, frequency, interval, weekdays_json, task_patch_json, block_templates_json, version, created_at, updated_at, deleted_at';
      update_sql := 'series_id = excluded.series_id, effective_from = excluded.effective_from, frequency = excluded.frequency, interval = excluded.interval, weekdays_json = excluded.weekdays_json, task_patch_json = excluded.task_patch_json, block_templates_json = excluded.block_templates_json, deleted_at = excluded.deleted_at';
      conflict_sql := 'id';
    when 'transfer_history' then
      columns_sql := 'id, user_id, task_item_id, reason, returned_at, version, created_at, updated_at, deleted_at';
      update_sql := 'task_item_id = excluded.task_item_id, reason = excluded.reason, returned_at = excluded.returned_at, deleted_at = excluded.deleted_at';
      conflict_sql := 'id';
    when 'daily_energy_entries' then
      columns_sql := 'id, user_id, recorded_on, energy_percent, version, created_at, updated_at, deleted_at';
      update_sql := 'energy_percent = excluded.energy_percent, deleted_at = excluded.deleted_at';
      conflict_sql := 'user_id, recorded_on';
    when 'user_settings' then
      columns_sql := 'id, user_id, workday_starts_at, workday_ends_at, evening_review_at, notification_lead_minutes, completion_prompt_deferred_on, version, created_at, updated_at, deleted_at';
      update_sql := 'workday_starts_at = excluded.workday_starts_at, workday_ends_at = excluded.workday_ends_at, evening_review_at = excluded.evening_review_at, notification_lead_minutes = excluded.notification_lead_minutes, completion_prompt_deferred_on = excluded.completion_prompt_deferred_on, deleted_at = excluded.deleted_at';
      conflict_sql := 'user_id';
  end case;

  if p_expected_version <> 0 then
    -- A non-zero expected version can only update a row that already exists.
    existing_row := null;
    if p_entity_type = 'daily_energy_entries' then
      select 1 into existing_row from public.daily_energy_entries where user_id = p_user_id and recorded_on = p_entity_id::date for update;
    elsif p_entity_type = 'user_settings' then
      select 1 into existing_row from public.user_settings where user_id = p_user_id for update;
    else
      execute format('select 1 from public.%I where user_id = $1 and id = $2::uuid for update', table_name)
      into existing_row using p_user_id, p_entity_id;
    end if;
    if existing_row is null then raise exception 'Sync version conflict.' using errcode = 'P0001'; end if;
  end if;

  execute format(
    'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) '
    || 'on conflict (%3$s) do update set %4$s where public.%1$I.user_id = $2 and public.%1$I.version = $3 returning version',
    table_name, columns_sql, conflict_sql, update_sql
  ) into applied_version using row_payload, p_user_id, p_expected_version;
  if applied_version is null then raise exception 'Sync version conflict.' using errcode = 'P0001'; end if;
  return applied_version;
end;
$$;

create or replace function public.apply_sync_mutations(p_mutations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := public.sync_require_account_owner();
  account_generation bigint;
  mutation jsonb;
  client_mutation_id text;
  entity_type text;
  entity_id text;
  operation text;
  expected_version bigint;
  applied_version bigint;
  stored_result jsonb;
  results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_mutations) <> 'array' then raise exception 'Mutations must be an array.' using errcode = '22023'; end if;
  select data_generation into account_generation from public.account_state where user_id = owner_id for update;
  if account_generation is null then raise exception 'Account state was not found.' using errcode = 'P0002'; end if;

  for mutation in
    select value from jsonb_array_elements(p_mutations) with ordinality as input(value, ordinal)
    order by case when value ->> 'operation' = 'delete' then -case value ->> 'entityType'
      when 'projects' then 1 when 'task_items' then 2 when 'reminders' then 2 when 'recurrence_series' then 3
      when 'recurrence_revisions' then 4 when 'recurrence_occurrences' then 5 when 'schedule_blocks' then 6
      when 'transfer_history' then 7 when 'daily_energy_entries' then 8 when 'user_settings' then 9 else 99 end
      else case value ->> 'entityType'
        when 'projects' then 1 when 'task_items' then 2 when 'reminders' then 2 when 'recurrence_series' then 3
        when 'recurrence_revisions' then 4 when 'recurrence_occurrences' then 5 when 'schedule_blocks' then 6
        when 'transfer_history' then 7 when 'daily_energy_entries' then 8 when 'user_settings' then 9 else 99 end end,
      ordinal
  loop
    client_mutation_id := mutation ->> 'mutationId'; entity_type := mutation ->> 'entityType'; entity_id := mutation ->> 'entityId';
    operation := mutation ->> 'operation'; expected_version := (mutation ->> 'expectedVersion')::bigint;
    if client_mutation_id is null or entity_type is null or entity_id is null or operation is null or expected_version is null
      or (mutation ->> 'dataGeneration')::bigint <> account_generation then
      raise exception 'Invalid or stale sync mutation.' using errcode = '22023';
    end if;

    select ledger.result into stored_result from public.sync_mutations as ledger where ledger.user_id = owner_id and ledger.mutation_id = client_mutation_id;
    if found then results := results || jsonb_build_array(stored_result); continue; end if;
    insert into public.sync_mutations (user_id, mutation_id, result) values (owner_id, client_mutation_id, '{}'::jsonb)
    on conflict (user_id, mutation_id) do nothing;
    if not found then
      select ledger.result into stored_result from public.sync_mutations as ledger where ledger.user_id = owner_id and ledger.mutation_id = client_mutation_id;
      results := results || jsonb_build_array(stored_result); continue;
    end if;

    applied_version := public.sync_apply_entity(owner_id, entity_type, entity_id, operation, expected_version, mutation -> 'payload');
    stored_result := jsonb_build_object('mutationId', client_mutation_id, 'entityType', entity_type, 'entityId', entity_id, 'operation', operation, 'version', applied_version);
    update public.sync_mutations as ledger set result = stored_result where ledger.user_id = owner_id and ledger.mutation_id = client_mutation_id;
    insert into public.sync_changes (user_id, entity_type, entity_id, operation, version)
    values (owner_id, entity_type, entity_id, operation, applied_version);
    results := results || jsonb_build_array(stored_result);
  end loop;
  return results;
end;
$$;

create or replace function public.pull_sync_changes(p_cursor bigint default 0, p_limit integer default 100)
returns table(change_cursor bigint, entity_type text, entity_id text, operation text, version bigint, changed_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select change_cursor, entity_type, entity_id, operation, version, changed_at
  from public.sync_changes
  where user_id = public.sync_require_account_owner()
    and change_cursor > greatest(coalesce(p_cursor, 0), 0)
  order by change_cursor asc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

-- Clear data keeps the authenticated identity but invalidates every old outbox.
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
  delete from public.legal_acceptances where user_id = p_user_id;
  delete from public.privacy_preferences where user_id = p_user_id;
  update public.account_state set data_generation = data_generation + 1 where user_id = p_user_id returning data_generation into next_generation;
  update public.profiles set data_generation = data_generation + 1 where id = p_user_id;
  if next_generation is null then raise exception 'Account profile was not found.' using errcode = 'P0002'; end if;
  return next_generation;
end;
$$;

revoke all on function public.sync_require_account_owner() from public;
revoke all on function public.sync_normalize_payload(text, text, uuid, jsonb) from public;
revoke all on function public.sync_apply_entity(uuid, text, text, text, bigint, jsonb) from public;
revoke all on function public.apply_sync_mutations(jsonb) from public;
revoke all on function public.pull_sync_changes(bigint, integer) from public;
grant execute on function public.apply_sync_mutations(jsonb) to authenticated;
grant execute on function public.pull_sync_changes(bigint, integer) to authenticated;
