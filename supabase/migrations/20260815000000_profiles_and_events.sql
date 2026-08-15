-- Minimal cloud foundation: per-user profile row and an append-only
-- behavioral event log. Both tables are user-owned and isolated by RLS.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select
  using (id = auth.uid());

-- Every auth.users row (including anonymous sign-ins) gets a matching
-- profile row automatically; SECURITY DEFINER lets this bypass RLS,
-- so clients never need (and are not granted) an insert policy.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index events_user_entity_occurred_idx
  on public.events (user_id, entity_id, occurred_at);

create index events_user_type_occurred_idx
  on public.events (user_id, event_type, occurred_at);

alter table public.events enable row level security;

-- No update/delete policies: events are append-only, so both remain
-- denied by default once RLS is enabled.
create policy "events_select_own" on public.events
  for select
  using (user_id = auth.uid());

create policy "events_insert_own" on public.events
  for insert
  with check (user_id = auth.uid());
