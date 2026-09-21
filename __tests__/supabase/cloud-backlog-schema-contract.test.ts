function readBacklogMigration(): string {
  const fileSystem = jest.requireActual<{ existsSync(path: string): boolean; readFileSync(path: string, encoding: string): string }>('node:fs');
  const path = `${process.cwd()}/supabase/migrations/20260903030000_cloud_backlog_schema.sql`;
  expect(fileSystem.existsSync(path)).toBe(true);
  return fileSystem.readFileSync(path, 'utf8');
}

describe('cloud backlog schema contract', () => {
  test('stores complete project, task and reminder rows with owner-safe composite relations', () => {
    const migration = readBacklogMigration();

    for (const table of ['projects', 'task_items', 'reminders']) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain('user_id uuid not null references auth.users (id) on delete cascade');
      expect(migration).toContain('version bigint not null default 1 check (version > 0)');
      expect(migration).toContain('updated_at timestamptz not null default now()');
      expect(migration).toContain('deleted_at timestamptz');
    }

    expect(migration).toContain('unique (id, user_id)');
    expect(migration).toContain('foreign key (project_id, user_id) references public.projects (id, user_id)');
    expect(migration).toContain('foreign key (parent_task_id, user_id) references public.task_items (id, user_id)');
    expect(migration).toContain('foreign key (linked_task_item_id, user_id) references public.task_items (id, user_id)');
    expect(migration).toContain("kind in ('task', 'subtask')");
    expect(migration).toContain("repeat_frequency in ('daily', 'weekly', 'monthly', 'yearly', 'intervalDays')");
    expect(migration).toContain('create or replace function public.touch_cloud_backlog_updated_at');
    expect(migration).toContain('create trigger projects_touch_updated_at');
    expect(migration).toContain('create trigger task_items_touch_updated_at');
    expect(migration).toContain('create trigger reminders_touch_updated_at');
  });
});
