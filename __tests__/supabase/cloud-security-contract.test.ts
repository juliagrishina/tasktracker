function readSecurityMigration(): string {
  const fileSystem = jest.requireActual<{
    existsSync(path: string): boolean;
    readFileSync(path: string, encoding: string): string;
  }>('node:fs');
  const path = `${process.cwd()}/supabase/migrations/20260903032000_cloud_data_security.sql`;
  expect(fileSystem.existsSync(path)).toBe(true);
  return fileSystem.readFileSync(path, 'utf8');
}

describe('cloud business-data security contract', () => {
  test('enables RLS, permits only owner reads and blocks anonymous identities', () => {
    const migration = readSecurityMigration();

    for (const table of [
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
      'account_state',
    ]) {
      expect(migration).toContain(`'${table}'`);
    }

    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on table public.%I from public, anon, authenticated');
    expect(migration).toContain('grant select on table public.%I to authenticated');
    expect(migration).toContain('using (user_id = auth.uid())');
    expect(migration).toContain('not public.current_identity_is_anonymous()');
  });

  test('keeps critical relational invariants on the server', () => {
    const migration = readSecurityMigration();

    expect(migration).toContain('create or replace function public.enforce_task_item_parent_kind');
    expect(migration).toContain("parent task must be an active task");
    expect(migration).toContain('create or replace function public.enforce_schedule_block_occurrence_owner');
    expect(migration).toContain("scheduled occurrence must belong to the block''s task");
    expect(migration).toContain('before insert or update of kind, parent_task_id, user_id on public.task_items');
    expect(migration).toContain('before insert or update of task_item_id, occurrence_id, user_id on public.schedule_blocks');
  });
});
