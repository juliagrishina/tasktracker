-- Epic 11 / Task 1: permanent-account foundation.
--
-- The existing anonymous Auth users are deliberately retained.  When such an
-- identity is linked to email/password later, GoTrue keeps auth.users.id and
-- this migration's profile row follows that id without copying data.

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists updated_at timestamptz,
  add column if not exists version bigint;

update public.profiles
set
  updated_at = coalesce(updated_at, created_at, now()),
  version = coalesce(version, 1)
where updated_at is null or version is null;

alter table public.profiles
  alter column updated_at set default now(),
  alter column updated_at set not null,
  alter column version set default 1,
  alter column version set not null;

alter table public.profiles
  drop constraint if exists profiles_version_is_positive;

alter table public.profiles
  add constraint profiles_version_is_positive check (version > 0);

create or replace function public.set_profile_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.display_name := nullif(btrim(new.display_name), '');
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

drop trigger if exists profiles_set_metadata on public.profiles;
create trigger profiles_set_metadata
  before update on public.profiles
  for each row execute function public.set_profile_metadata();

-- Replacing the pre-E11 trigger is safe: it retains the existing trigger
-- name, creates no duplicate profiles and accepts profile metadata supplied
-- during a later identity-linking registration.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Older anonymous users predate the expanded trigger.  Backfill only missing
-- rows so their original user ids and any existing profile data remain intact.
insert into public.profiles (id, display_name)
select
  users.id,
  nullif(btrim(coalesce(users.raw_user_meta_data ->> 'display_name', '')), '')
from auth.users as users
on conflict (id) do nothing;

create table if not exists public.legal_acceptances (
  user_id uuid not null references auth.users (id) on delete cascade,
  document_type text not null,
  document_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'app',
  primary key (user_id, document_type, document_version),
  constraint legal_acceptances_source_not_blank check (btrim(source) <> '')
);

create table if not exists public.privacy_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  analytics_events_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  constraint privacy_preferences_version_is_positive check (version > 0)
);

create or replace function public.set_privacy_preferences_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

drop trigger if exists privacy_preferences_set_metadata on public.privacy_preferences;
create trigger privacy_preferences_set_metadata
  before update on public.privacy_preferences
  for each row execute function public.set_privacy_preferences_metadata();

alter table public.legal_acceptances enable row level security;
alter table public.privacy_preferences enable row level security;

-- Supabase gives anonymous identities the authenticated role.  A restrictive
-- policy is therefore the required second guard in addition to user ownership.
create or replace function public.current_identity_is_anonymous()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

drop policy if exists "events_block_anonymous" on public.events;
create policy "events_block_anonymous" on public.events
  as restrictive
  for all
  to authenticated
  using (not public.current_identity_is_anonymous())
  with check (not public.current_identity_is_anonymous());

drop policy if exists "events_insert_own" on public.events;
drop policy if exists "events_insert_own_with_analytics_consent" on public.events;
create policy "events_insert_own_with_analytics_consent" on public.events
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.privacy_preferences as preferences
      where preferences.user_id = auth.uid()
        and preferences.analytics_events_enabled = true
    )
  );

drop policy if exists "legal_acceptances_select_own" on public.legal_acceptances;
drop policy if exists "legal_acceptances_insert_own" on public.legal_acceptances;
drop policy if exists "legal_acceptances_block_anonymous" on public.legal_acceptances;
create policy "legal_acceptances_select_own" on public.legal_acceptances
  for select
  to authenticated
  using (user_id = auth.uid());
create policy "legal_acceptances_insert_own" on public.legal_acceptances
  for insert
  to authenticated
  with check (user_id = auth.uid());
create policy "legal_acceptances_block_anonymous" on public.legal_acceptances
  as restrictive
  for all
  to authenticated
  using (not public.current_identity_is_anonymous())
  with check (not public.current_identity_is_anonymous());

drop policy if exists "privacy_preferences_select_own" on public.privacy_preferences;
drop policy if exists "privacy_preferences_insert_own" on public.privacy_preferences;
drop policy if exists "privacy_preferences_update_own" on public.privacy_preferences;
drop policy if exists "privacy_preferences_block_anonymous" on public.privacy_preferences;
create policy "privacy_preferences_select_own" on public.privacy_preferences
  for select
  to authenticated
  using (user_id = auth.uid());
create policy "privacy_preferences_insert_own" on public.privacy_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());
create policy "privacy_preferences_update_own" on public.privacy_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "privacy_preferences_block_anonymous" on public.privacy_preferences
  as restrictive
  for all
  to authenticated
  using (not public.current_identity_is_anonymous())
  with check (not public.current_identity_is_anonymous());

-- No client role receives mutation rights outside the narrow policies above.
grant select on public.profiles to authenticated;
grant select, insert on public.events to authenticated;
grant select, insert on public.legal_acceptances to authenticated;
grant select, insert, update on public.privacy_preferences to authenticated;

revoke all on public.profiles from anon;
revoke all on public.events from anon;
revoke all on public.legal_acceptances from anon;
revoke all on public.privacy_preferences from anon;
revoke update, delete on public.events from authenticated;
revoke insert, update, delete on public.profiles from authenticated;
revoke delete on public.legal_acceptances from authenticated;
revoke delete on public.privacy_preferences from authenticated;

-- Analytics was not previously an opt-in feature.  Remove legacy anonymous
-- events before enforcing the policy, preserving regular-account history.
delete from public.events
using auth.users as users
where public.events.user_id = users.id
  and users.is_anonymous = true;
