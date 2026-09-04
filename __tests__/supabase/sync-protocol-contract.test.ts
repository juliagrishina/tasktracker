function readRepositoryFile(...segments: string[]): string {
  const fileSystem = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('node:fs');
  return fileSystem.readFileSync(`${process.cwd()}/${segments.join('/')}`, 'utf8');
}

describe('cloud sync protocol contract', () => {
  test('makes a mutation idempotent and guards it by owner, generation and version', () => {
    const migration = readRepositoryFile('supabase', 'migrations', '20260903033000_sync_protocol.sql');

    expect(migration).toContain('create table public.sync_mutations');
    expect(migration).toContain('unique (user_id, mutation_id)');
    expect(migration).toContain('create or replace function public.apply_sync_mutations');
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain('current_identity_is_anonymous');
    expect(migration).toContain('data_generation');
    expect(migration).toContain('expected_version');
    expect(migration).toContain('for update');
    expect(migration).toContain('on conflict (user_id, mutation_id)');
    expect(migration).toContain('with ordinality');
    expect(migration).toContain("when 'projects' then 1");
    expect(migration).toContain("when 'task_items' then 2");
  });

  test('provides an ordered change log and a resumable owner-bound cursor', () => {
    const migration = readRepositoryFile('supabase', 'migrations', '20260903033000_sync_protocol.sql');

    expect(migration).toContain('create table public.sync_changes');
    expect(migration).toContain('change_cursor bigint generated always as identity');
    expect(migration).toContain('create or replace function public.pull_sync_changes');
    expect(migration).toContain('p_cursor bigint');
    expect(migration).toContain('order by change_cursor asc');
    expect(migration).toContain('grant execute on function public.apply_sync_mutations(jsonb) to authenticated');
    expect(migration).toContain('grant execute on function public.pull_sync_changes(bigint, integer) to authenticated');
  });

  test('keeps the Edge boundary in the JWT owner context and never uses the service role', () => {
    const source = readRepositoryFile('supabase', 'functions', 'sync-protocol', 'index.ts');
    const config = readRepositoryFile('supabase', 'config.toml');

    expect(source).toContain("request.headers.get('Authorization')");
    expect(source).toContain('userClient.auth.getUser(token)');
    expect(source).toContain("userClient.rpc('apply_sync_mutations'");
    expect(source).toContain("userClient.rpc('pull_sync_changes'");
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(config).toContain('[functions.sync-protocol]');
    expect(config).toContain('verify_jwt = true');
  });

  test('returns an owner-scoped server snapshot and continues after an optimistic-lock conflict', () => {
    const migration = readRepositoryFile('supabase', 'migrations', '20260904020000_sync_conflict_snapshot.sql');
    const source = readRepositoryFile('supabase', 'functions', 'sync-protocol', 'index.ts');

    expect(migration).toContain('get_sync_conflict_snapshot');
    expect(migration).toContain('sync_require_account_owner()');
    expect(migration).toContain("'projects', 'task_items', 'reminders', 'schedule_blocks'");
    expect(source).toContain("p_mutations: [mutation]");
    expect(source).toContain("applyError.message.includes('Sync version conflict.')");
    expect(source).toContain("get_sync_conflict_snapshot");
    expect(source).toContain('return respond({ mutations, conflicts });');
  });
});
