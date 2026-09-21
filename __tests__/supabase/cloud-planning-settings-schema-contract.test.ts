function readPlanningMigration(): string {
  const fileSystem = jest.requireActual<{
    existsSync(path: string): boolean;
    readFileSync(path: string, encoding: string): string;
  }>('node:fs');
  const path = `${process.cwd()}/supabase/migrations/20260903031000_cloud_planning_and_settings_schema.sql`;
  expect(fileSystem.existsSync(path)).toBe(true);
  return fileSystem.readFileSync(path, 'utf8');
}

describe('cloud planning and settings schema contract', () => {
  test('keeps planning and recurrence relations owner-safe and tombstone-ready', () => {
    const migration = readPlanningMigration();

    for (const table of [
      'schedule_blocks',
      'recurrence_series',
      'recurrence_occurrences',
      'recurrence_revisions',
      'transfer_history',
      'daily_energy_entries',
    ]) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain('version bigint not null default 1 check (version > 0)');
      expect(migration).toContain('updated_at timestamptz not null default now()');
      expect(migration).toContain('deleted_at timestamptz');
    }

    expect(migration).toContain('foreign key (task_item_id, user_id) references public.task_items (id, user_id)');
    expect(migration).toContain('foreign key (occurrence_id, user_id) references public.recurrence_occurrences (id, user_id)');
    expect(migration).toContain('foreign key (series_id, user_id) references public.recurrence_series (id, user_id)');
    expect(migration).toContain('foreign key (task_series_item_id, user_id) references public.task_items (id, user_id)');
    expect(migration).toContain('foreign key (reminder_series_item_id, user_id) references public.reminders (id, user_id)');
    expect(migration).toContain("item_kind in ('task', 'reminder')");
    expect(migration).toContain("frequency in ('daily', 'weekly', 'monthly', 'yearly', 'intervalDays')");
    expect(migration).toContain('unique (user_id, recorded_on)');
  });

  test('separates synced account settings from device-only configuration', () => {
    const migration = readPlanningMigration();

    expect(migration).toContain('create table public.user_settings');
    expect(migration).toContain('workday_starts_at text not null');
    expect(migration).toContain('completion_prompt_deferred_on date');
    expect(migration).toContain('create table public.user_devices');
    expect(migration).toContain('device_id uuid not null');
    expect(migration).toContain("time_zone_mode text not null check (time_zone_mode in ('device', 'manual'))");
    expect(migration).toContain('manual_time_zone_id text');
    expect(migration).toContain('notification_permission_state text');
    expect(migration).toContain('last_successful_sync_at timestamptz');
    expect(migration).toContain('create table public.account_state');
    expect(migration).toContain('data_generation bigint not null default 1 check (data_generation > 0)');
    expect(migration).not.toContain('notification_ids_json');
    expect(migration).not.toContain('evening_review_notification_id');
  });
});
