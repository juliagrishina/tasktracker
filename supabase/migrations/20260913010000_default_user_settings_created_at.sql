-- The settings singleton is local-only until it enters the sync outbox and
-- intentionally has no createdAt property. `jsonb_populate_record` converts a
-- missing explicit column to null, bypassing the table default, so assign a
-- server timestamp while normalizing this one entity.
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
    normalized := normalized || jsonb_build_object(
      'id', gen_random_uuid()::text,
      'created_at', case
        when jsonb_typeof(normalized -> 'created_at') = 'string' then normalized -> 'created_at'
        else to_jsonb(now()::text)
      end
    );
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

revoke all on function public.sync_normalize_payload(text, text, uuid, jsonb) from public;
grant execute on function public.sync_normalize_payload(text, text, uuid, jsonb) to authenticated;
