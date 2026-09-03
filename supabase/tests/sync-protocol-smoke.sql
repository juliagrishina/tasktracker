-- Runtime smoke for E11-T18. Run in local Supabase Postgres as postgres.
begin;

delete from auth.users where id = '33333333-3333-3333-3333-333333333333'::uuid;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
values ('00000000-0000-0000-0000-000000000000'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'authenticated', 'authenticated', 'e11-sync-smoke@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false);

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;

do $$
declare
  first_result jsonb;
  duplicate_result jsonb;
  pull_count integer;
  stale_rejected boolean := false;
  generation_rejected boolean := false;
begin
  first_result := public.apply_sync_mutations(jsonb_build_array(jsonb_build_object(
    'mutationId', 'smoke-mutation-1', 'entityType', 'projects', 'entityId', '44444444-4444-4444-4444-444444444444',
    'operation', 'upsert', 'expectedVersion', 0, 'dataGeneration', 1,
    'payload', jsonb_build_object('title', 'Sync smoke', 'description', null, 'completedAt', null, 'createdAt', now()::text, 'updatedAt', now()::text, 'deletedAt', null)
  )));
  duplicate_result := public.apply_sync_mutations(jsonb_build_array(jsonb_build_object(
    'mutationId', 'smoke-mutation-1', 'entityType', 'projects', 'entityId', '44444444-4444-4444-4444-444444444444',
    'operation', 'upsert', 'expectedVersion', 0, 'dataGeneration', 1,
    'payload', jsonb_build_object('title', 'Sync smoke', 'description', null, 'completedAt', null, 'createdAt', now()::text, 'updatedAt', now()::text, 'deletedAt', null)
  )));
  if first_result <> duplicate_result or (select version from public.projects where id = '44444444-4444-4444-4444-444444444444'::uuid) <> 1 then
    raise exception 'duplicate mutation was not idempotent';
  end if;
  perform public.apply_sync_mutations(jsonb_build_array(
    jsonb_build_object(
      'mutationId', 'smoke-task-before-project', 'entityType', 'task_items', 'entityId', '77777777-7777-7777-7777-777777777777',
      'operation', 'upsert', 'expectedVersion', 0, 'dataGeneration', 1,
      'payload', jsonb_build_object('kind', 'task', 'projectId', '66666666-6666-6666-6666-666666666666', 'parentTaskId', null, 'title', 'Dependent task', 'description', null, 'estimatedDurationMinutes', null, 'scheduledOn', null, 'periodStartOn', null, 'periodEndOn', null, 'completedAt', null, 'createdAt', now()::text, 'updatedAt', now()::text, 'deletedAt', null)
    ),
    jsonb_build_object(
      'mutationId', 'smoke-project-after-task', 'entityType', 'projects', 'entityId', '66666666-6666-6666-6666-666666666666',
      'operation', 'upsert', 'expectedVersion', 0, 'dataGeneration', 1,
      'payload', jsonb_build_object('title', 'Dependency project', 'description', null, 'completedAt', null, 'createdAt', now()::text, 'updatedAt', now()::text, 'deletedAt', null)
    )
  ));
  if not exists (select 1 from public.task_items where id = '77777777-7777-7777-7777-777777777777'::uuid) then
    raise exception 'dependency ordering did not apply the project before its task';
  end if;
  select count(*) into pull_count from public.pull_sync_changes(0, 10);
  if pull_count <> 3 then raise exception 'cursor pull did not return the applied changes'; end if;
  begin
    perform public.apply_sync_mutations(jsonb_build_array(jsonb_build_object(
      'mutationId', 'smoke-mutation-stale', 'entityType', 'projects', 'entityId', '44444444-4444-4444-4444-444444444444',
      'operation', 'upsert', 'expectedVersion', 0, 'dataGeneration', 1,
      'payload', jsonb_build_object('title', 'Stale', 'description', null, 'completedAt', null, 'createdAt', now()::text, 'updatedAt', now()::text, 'deletedAt', null)
    )));
  exception when sqlstate 'P0001' then
    stale_rejected := true;
  end;
  if not stale_rejected then raise exception 'stale version was accepted'; end if;
  begin
    perform public.apply_sync_mutations(jsonb_build_array(jsonb_build_object(
      'mutationId', 'smoke-mutation-generation', 'entityType', 'projects', 'entityId', '55555555-5555-5555-5555-555555555555',
      'operation', 'upsert', 'expectedVersion', 0, 'dataGeneration', 0,
      'payload', jsonb_build_object('title', 'Stale generation', 'description', null, 'completedAt', null, 'createdAt', now()::text, 'updatedAt', now()::text, 'deletedAt', null)
    )));
  exception when sqlstate '22023' then
    generation_rejected := true;
  end;
  if not generation_rejected then raise exception 'stale data generation was accepted'; end if;
end;
$$;

reset role;
rollback;
