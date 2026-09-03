function readRepositoryFile(...segments: string[]): string {
  const fileSystem = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('node:fs');
  return fileSystem.readFileSync(`${process.cwd()}/${segments.join('/')}`, 'utf8');
}

describe('Epic 11 account profile contracts', () => {
  test('syncs display name from authenticated metadata into the canonical profile row', () => {
    const migration = readRepositoryFile('supabase', 'migrations', '20260903020000_account_profile.sql');

    expect(migration).toContain('create or replace function public.sync_profile_display_name_from_auth');
    expect(migration).toContain('after update of raw_user_meta_data on auth.users');
    expect(migration).toContain("new.raw_user_meta_data ->> 'display_name'");
    expect(migration).toContain('update public.profiles');
  });

  test('cancels only the authenticated user pending email change through a user-scoped database function', () => {
    const migration = readRepositoryFile('supabase', 'migrations', '20260903021000_cancel_pending_email_change.sql');
    const edgeFunction = readRepositoryFile('supabase', 'functions', 'cancel-email-change', 'index.ts');

    expect(migration).toContain('create or replace function public.cancel_pending_email_change()');
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain('email_change = \'\'');
    expect(migration).toContain("grant execute on function public.cancel_pending_email_change() to authenticated");
    expect(edgeFunction).toContain('auth.getUser(token)');
    expect(edgeFunction).toContain('user.new_email');
    expect(edgeFunction).toContain("rpc('cancel_pending_email_change')");
    expect(edgeFunction).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(edgeFunction).not.toContain('auth.admin.updateUserById');
    expect(edgeFunction).not.toContain('request.json');
  });
});
