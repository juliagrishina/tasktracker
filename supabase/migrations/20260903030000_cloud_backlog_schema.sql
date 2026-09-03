-- Epic 11 / Task 14: cloud representation of the current Backlog model.
-- RLS and client mutation policy are deliberately added in E11-T16.  These
-- tables already carry tombstones so future sync never needs a hard delete.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  completed_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.task_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('task', 'subtask')),
  project_id uuid,
  parent_task_id uuid,
  title text not null,
  description text,
  estimated_duration_minutes integer check (estimated_duration_minutes is null or estimated_duration_minutes > 0),
  scheduled_on date,
  period_start_on date,
  period_end_on date,
  completed_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint task_items_period_is_complete check (
    (period_start_on is null and period_end_on is null)
    or (period_start_on is not null and period_end_on is not null and period_start_on <= period_end_on)
  ),
  constraint task_items_kind_parent_shape check (
    (kind = 'task' and parent_task_id is null)
    or (kind = 'subtask' and parent_task_id is not null)
  ),
  unique (id, user_id),
  foreign key (project_id, user_id) references public.projects (id, user_id),
  foreign key (parent_task_id, user_id) references public.task_items (id, user_id)
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  linked_task_item_id uuid,
  linked_occurrence_on date,
  reminds_on date,
  period_start_on date,
  period_end_on date,
  repeat_frequency text check (repeat_frequency is null or repeat_frequency in ('daily', 'weekly', 'monthly', 'yearly', 'intervalDays')),
  repeat_interval integer check (repeat_interval is null or repeat_interval > 0),
  repeat_weekdays_json jsonb,
  estimated_duration_minutes integer check (estimated_duration_minutes is null or estimated_duration_minutes > 0),
  completed_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint reminders_period_is_complete check (
    (period_start_on is null and period_end_on is null)
    or (period_start_on is not null and period_end_on is not null and period_start_on <= period_end_on)
  ),
  constraint reminders_repeat_is_complete check (
    (repeat_frequency is null and repeat_interval is null)
    or (repeat_frequency is not null and repeat_interval is not null)
  ),
  unique (id, user_id),
  foreign key (linked_task_item_id, user_id) references public.task_items (id, user_id)
);

create index projects_live_user_created_idx
  on public.projects (user_id, created_at, id)
  where deleted_at is null;

create index task_items_live_user_created_idx
  on public.task_items (user_id, created_at, id)
  where deleted_at is null;

create index task_items_live_project_idx
  on public.task_items (user_id, project_id)
  where deleted_at is null and project_id is not null;

create index task_items_live_parent_idx
  on public.task_items (user_id, parent_task_id)
  where deleted_at is null and parent_task_id is not null;

create index reminders_live_user_created_idx
  on public.reminders (user_id, created_at, id)
  where deleted_at is null;

create index reminders_live_task_idx
  on public.reminders (user_id, linked_task_item_id)
  where deleted_at is null and linked_task_item_id is not null;

-- `updated_at` and the sync version are always assigned by PostgreSQL, rather
-- than trusting a timestamp or version supplied by a device.
create or replace function public.touch_cloud_backlog_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$;

create trigger projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_cloud_backlog_updated_at();

create trigger task_items_touch_updated_at
before update on public.task_items
for each row execute function public.touch_cloud_backlog_updated_at();

create trigger reminders_touch_updated_at
before update on public.reminders
for each row execute function public.touch_cloud_backlog_updated_at();
