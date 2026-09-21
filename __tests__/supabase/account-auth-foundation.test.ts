function readRepositoryFile(...segments: string[]): string {
  const fileSystem = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('node:fs');
  return fileSystem.readFileSync(`${process.cwd()}/${segments.join('/')}`, 'utf8');
}

describe('Epic 11 account Auth foundation', () => {
  test('adds idempotent profile and consent schema while retaining anonymous user ids', () => {
    const migration = readRepositoryFile('supabase', 'migrations', '20260902000000_account_auth_foundation.sql');

    expect(migration).toMatch(/add column if not exists display_name text/i);
    expect(migration).toMatch(/add column if not exists updated_at timestamptz/i);
    expect(migration).toMatch(/add column if not exists version bigint/i);
    expect(migration).toMatch(/insert into public\.profiles \(id/i);
    expect(migration).toMatch(/on conflict \(id\) do nothing/i);
    expect(migration).toContain('create table if not exists public.legal_acceptances');
    expect(migration).toContain('create table if not exists public.privacy_preferences');
  });

  test('blocks anonymous identities from cloud events and requires explicit analytics consent', () => {
    const migration = readRepositoryFile('supabase', 'migrations', '20260902000000_account_auth_foundation.sql');

    expect(migration).toContain('create policy "events_block_anonymous"');
    expect(migration).toContain("auth.jwt() ->> 'is_anonymous'");
    expect(migration).toContain('create policy "events_insert_own_with_analytics_consent"');
    expect(migration).toContain('analytics_events_enabled = true');
    expect(migration).toContain('delete from public.events');
  });

  test('keeps local Auth settings aligned with the approved email/password policy', () => {
    const config = readRepositoryFile('supabase', 'config.toml');

    expect(config).toContain('enable_manual_linking = true');
    expect(config).toContain('minimum_password_length = 10');
    expect(config).toContain('password_requirements = "lower_upper_letters_digits_symbols"');
    expect(config).toContain('enable_confirmations = true');
    expect(config).toContain('double_confirm_changes = false');
    expect(config).toContain('secure_password_change = true');
    expect(config).toContain('otp_expiry = 600');
  });
});
