-- Runtime RLS smoke for E11-T1.
-- Run inside the local Supabase Postgres container as postgres:
--   psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/account-auth-foundation-smoke.sql
--
-- The transaction is always rolled back, so the test does not leave Auth users,
-- profiles, preferences or events in the local database.

begin;

delete from auth.users
where id in (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_anonymous
)
values
  (
    '00000000-0000-0000-0000-000000000000'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'authenticated',
    'authenticated',
    'e11-anonymous-smoke@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    true
  ),
  (
    '00000000-0000-0000-0000-000000000000'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    'authenticated',
    'authenticated',
    'e11-member-smoke@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    false
  );

do $$
begin
  if (select count(*) from public.profiles where id in (
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid
  )) <> 2 then
    raise exception 'profile trigger did not create exactly one profile for each auth user';
  end if;
end;
$$;

-- Anonymous Auth uses the authenticated database role, therefore the JWT claim
-- must be checked by a restrictive policy in addition to ordinary ownership.
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":true}',
  true
);
set local role authenticated;
do $$
begin
  begin
    insert into public.events (user_id, entity_type, entity_id, event_type)
    values ('11111111-1111-1111-1111-111111111111'::uuid, 'smoke', 'anonymous', 'attempted');
  exception
    when insufficient_privilege then
      return;
  end;

  raise exception 'anonymous identity unexpectedly inserted an event';
end;
$$;
reset role;

-- An ordinary account is still denied until it explicitly enables analytics.
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","is_anonymous":false}',
  true
);
set local role authenticated;
do $$
begin
  begin
    insert into public.events (user_id, entity_type, entity_id, event_type)
    values ('22222222-2222-2222-2222-222222222222'::uuid, 'smoke', 'without-consent', 'attempted');
  exception
    when insufficient_privilege then
      return;
  end;

  raise exception 'account without analytics consent unexpectedly inserted an event';
end;
$$;
reset role;

insert into public.privacy_preferences (user_id, analytics_events_enabled)
values ('22222222-2222-2222-2222-222222222222'::uuid, true);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","is_anonymous":false}',
  true
);
set local role authenticated;
insert into public.events (user_id, entity_type, entity_id, event_type)
values ('22222222-2222-2222-2222-222222222222'::uuid, 'smoke', 'with-consent', 'accepted');

do $$
begin
  if (select count(*) from public.events where user_id = '22222222-2222-2222-2222-222222222222'::uuid) <> 1 then
    raise exception 'consenting account cannot read its own event';
  end if;
end;
$$;

rollback;
