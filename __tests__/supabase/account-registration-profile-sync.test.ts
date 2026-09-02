function readRepositoryFile(...segments: string[]): string {
  const fileSystem = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('node:fs');
  return fileSystem.readFileSync(`${process.cwd()}/${segments.join('/')}`, 'utf8');
}

describe('account registration profile sync migration', () => {
  test('copies a linked identity display name into its existing profile without changing the user id', () => {
    const migration = readRepositoryFile('supabase', 'migrations', '20260902010000_account_registration_profile_sync.sql');

    expect(migration).toContain('after insert or update of raw_user_meta_data on auth.users');
    expect(migration).toContain('on conflict (id) do update');
    expect(migration).toContain('excluded.display_name is not null');
  });
});
