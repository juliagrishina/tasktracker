-- Only a verified account generation mismatch may cause a client replica reset.
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
      when 'transfer_history' then 7 when 'daily_energy_entries' then 8 when 'user_settings' then 9 else 99 end end,
      case when value ->> 'operation' = 'delete' then 0 else 1 end,
      case value ->> 'entityType'
        when 'projects' then 1 when 'task_items' then 2 when 'reminders' then 2 when 'recurrence_series' then 3
        when 'recurrence_revisions' then 4 when 'recurrence_occurrences' then 5 when 'schedule_blocks' then 6
        when 'transfer_history' then 7 when 'daily_energy_entries' then 8 when 'user_settings' then 9 else 99 end,
      ordinal
  loop
    client_mutation_id := mutation ->> 'mutationId'; entity_type := mutation ->> 'entityType'; entity_id := mutation ->> 'entityId';
    operation := mutation ->> 'operation'; expected_version := (mutation ->> 'expectedVersion')::bigint;
    if client_mutation_id is null or entity_type is null or entity_id is null or operation is null or expected_version is null
      or mutation ->> 'dataGeneration' is null then
      raise exception 'Invalid sync mutation.' using errcode = '22023';
    end if;
    if (mutation ->> 'dataGeneration')::bigint <> account_generation then
      raise exception 'Sync data generation is stale.' using errcode = '22023';
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

revoke all on function public.apply_sync_mutations(jsonb) from public;
grant execute on function public.apply_sync_mutations(jsonb) to authenticated;
