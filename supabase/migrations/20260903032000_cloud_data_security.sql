-- Epic 11 / Task 16: cloud planner data are readable only by their regular
-- owner.  Browser mutations are intentionally deferred to the constrained
-- sync RPC in E11-T18; granting table writes here would bypass version checks.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'projects',
    'task_items',
    'reminders',
    'schedule_blocks',
    'recurrence_series',
    'recurrence_occurrences',
    'recurrence_revisions',
    'transfer_history',
    'daily_energy_entries',
    'user_settings',
    'user_devices',
    'account_state'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select on table public.%I to authenticated', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', table_name || '_select_own', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_block_anonymous', table_name);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (not public.current_identity_is_anonymous()) with check (not public.current_identity_is_anonymous())',
      table_name || '_block_anonymous',
      table_name
    );
  end loop;
end;
$$;

-- Profiles are identity metadata rather than planner rows, but an anonymous
-- session must not obtain a persistent-account profile through the shared
-- authenticated role either.
alter table public.profiles enable row level security;
revoke all on table public.profiles from anon;
grant select on table public.profiles to authenticated;
drop policy if exists profiles_block_anonymous on public.profiles;
create policy profiles_block_anonymous on public.profiles
  as restrictive
  for all
  to authenticated
  using (not public.current_identity_is_anonymous())
  with check (not public.current_identity_is_anonymous());

create or replace function public.enforce_task_item_parent_kind()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind = 'subtask' and not exists (
    select 1
    from public.task_items as parent_task
    where parent_task.id = new.parent_task_id
      and parent_task.user_id = new.user_id
      and parent_task.kind = 'task'
      and parent_task.deleted_at is null
  ) then
    raise exception 'parent task must be an active task';
  end if;

  return new;
end;
$$;

drop trigger if exists task_items_enforce_parent_kind on public.task_items;
create trigger task_items_enforce_parent_kind
before insert or update of kind, parent_task_id, user_id on public.task_items
for each row execute function public.enforce_task_item_parent_kind();

create or replace function public.enforce_schedule_block_occurrence_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.occurrence_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.recurrence_occurrences as occurrence
    join public.recurrence_series as series
      on series.id = occurrence.series_id
      and series.user_id = occurrence.user_id
    where occurrence.id = new.occurrence_id
      and occurrence.user_id = new.user_id
      and occurrence.deleted_at is null
      and series.deleted_at is null
      and series.item_kind = 'task'
      and series.item_id = new.task_item_id
  ) then
    raise exception 'scheduled occurrence must belong to the block''s task';
  end if;

  return new;
end;
$$;

drop trigger if exists schedule_blocks_enforce_occurrence_owner on public.schedule_blocks;
create trigger schedule_blocks_enforce_occurrence_owner
before insert or update of task_item_id, occurrence_id, user_id on public.schedule_blocks
for each row execute function public.enforce_schedule_block_occurrence_owner();
