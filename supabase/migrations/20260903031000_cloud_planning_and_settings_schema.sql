-- Epic 11 / Task 15: cloud representation of planning, recurrence and
-- settings.  RLS, grants and sync RPCs are deliberately added in E11-T16+.
-- Device-local notification identifiers are not copied to the cloud.

create table public.recurrence_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_kind text not null check (item_kind in ('task', 'reminder')),
  item_id uuid not null,
  task_series_item_id uuid,
  reminder_series_item_id uuid,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly', 'intervalDays')),
  interval integer not null check (interval > 0),
  weekdays_json jsonb,
  starts_on date not null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint recurrence_series_item_shape check (
    (item_kind = 'task' and task_series_item_id = item_id and reminder_series_item_id is null)
    or (item_kind = 'reminder' and reminder_series_item_id = item_id and task_series_item_id is null)
  ),
  unique (id, user_id),
  foreign key (task_series_item_id, user_id) references public.task_items (id, user_id),
  foreign key (reminder_series_item_id, user_id) references public.reminders (id, user_id)
);

create table public.recurrence_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  series_id uuid not null,
  occurs_on date not null,
  cancelled_at timestamptz,
  completed_at timestamptz,
  blocks_overridden boolean not null default false,
  task_patch_json jsonb,
  reminder_patch_json jsonb,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (series_id, user_id) references public.recurrence_series (id, user_id)
);

create unique index recurrence_occurrences_live_series_date_idx
  on public.recurrence_occurrences (user_id, series_id, occurs_on)
  where deleted_at is null;

create table public.recurrence_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  series_id uuid not null,
  effective_from date not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly', 'intervalDays')),
  interval integer not null check (interval > 0),
  weekdays_json jsonb,
  task_patch_json jsonb not null,
  block_templates_json jsonb not null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (series_id, user_id) references public.recurrence_series (id, user_id)
);

create unique index recurrence_revisions_live_effective_from_idx
  on public.recurrence_revisions (user_id, series_id, effective_from)
  where deleted_at is null;

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_item_id uuid not null,
  occurrence_id uuid,
  time_zone_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint schedule_blocks_time_range check (starts_at < ends_at),
  unique (id, user_id),
  foreign key (task_item_id, user_id) references public.task_items (id, user_id),
  foreign key (occurrence_id, user_id) references public.recurrence_occurrences (id, user_id)
);

create index schedule_blocks_live_task_idx
  on public.schedule_blocks (user_id, task_item_id, starts_at)
  where deleted_at is null;

create index schedule_blocks_live_occurrence_idx
  on public.schedule_blocks (user_id, occurrence_id)
  where deleted_at is null and occurrence_id is not null;

create table public.transfer_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_item_id uuid not null,
  reason text,
  returned_at timestamptz not null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (task_item_id, user_id) references public.task_items (id, user_id)
);

create index transfer_history_live_task_idx
  on public.transfer_history (user_id, task_item_id, returned_at)
  where deleted_at is null;

create table public.daily_energy_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recorded_on date not null,
  energy_percent integer check (
    energy_percent is null or (energy_percent >= 0 and energy_percent <= 100 and energy_percent % 5 = 0)
  ),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  unique (user_id, recorded_on)
);

create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workday_starts_at text not null,
  workday_ends_at text not null,
  evening_review_at text not null,
  notification_lead_minutes integer not null check (notification_lead_minutes >= 0),
  completion_prompt_deferred_on date,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  unique (user_id)
);

create table public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid not null,
  time_zone_mode text not null check (time_zone_mode in ('device', 'manual')),
  manual_time_zone_id text,
  notification_permission_state text,
  last_successful_sync_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint user_devices_manual_zone_shape check (
    (time_zone_mode = 'device' and manual_time_zone_id is null)
    or (time_zone_mode = 'manual' and manual_time_zone_id is not null)
  ),
  unique (id, user_id),
  unique (user_id, device_id)
);

create table public.account_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  data_generation bigint not null default 1 check (data_generation > 0),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  unique (user_id)
);

-- Existing accounts receive their state row before any future sync operation.
insert into public.account_state (user_id, data_generation)
select id, data_generation from public.profiles
on conflict (user_id) do nothing;

create or replace function public.create_account_state_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.account_state (user_id, data_generation)
  values (new.id, new.data_generation)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profile_account_state_create on public.profiles;
create trigger profile_account_state_create
after insert on public.profiles
for each row execute function public.create_account_state_for_profile();

create trigger recurrence_series_touch_updated_at
before update on public.recurrence_series
for each row execute function public.touch_cloud_backlog_updated_at();

create trigger recurrence_occurrences_touch_updated_at
before update on public.recurrence_occurrences
for each row execute function public.touch_cloud_backlog_updated_at();

create trigger recurrence_revisions_touch_updated_at
before update on public.recurrence_revisions
for each row execute function public.touch_cloud_backlog_updated_at();

create trigger schedule_blocks_touch_updated_at
before update on public.schedule_blocks
for each row execute function public.touch_cloud_backlog_updated_at();

create trigger transfer_history_touch_updated_at
before update on public.transfer_history
for each row execute function public.touch_cloud_backlog_updated_at();

create trigger daily_energy_entries_touch_updated_at
before update on public.daily_energy_entries
for each row execute function public.touch_cloud_backlog_updated_at();

create trigger user_settings_touch_updated_at
before update on public.user_settings
for each row execute function public.touch_cloud_backlog_updated_at();

create trigger user_devices_touch_updated_at
before update on public.user_devices
for each row execute function public.touch_cloud_backlog_updated_at();

create trigger account_state_touch_updated_at
before update on public.account_state
for each row execute function public.touch_cloud_backlog_updated_at();
