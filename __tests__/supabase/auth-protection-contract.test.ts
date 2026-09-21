function readRepositoryFile(...segments: string[]): string {
  const fileSystem = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('node:fs');
  return fileSystem.readFileSync(`${process.cwd()}/${segments.join('/')}`, 'utf8');
}

describe('Epic 11 Auth protection contract', () => {
  test('pins the approved redirect, OTP, rate-limit and CAPTCHA settings without SMTP secrets', () => {
    const config = readRepositoryFile('supabase', 'config.toml');
    const productionEnv = readRepositoryFile('supabase', 'production-auth.env.example');

    expect(config).toContain('site_url = "http://localhost:8081"');
    expect(config).toContain('"https://planmeplan.ru"');
    expect(config).toContain('otp_length = 6');
    expect(config).toContain('otp_expiry = 600');
    expect(config).toContain('[auth.rate_limit]');
    expect(config).toContain('sign_in_sign_ups = 10');
    expect(config).toContain('[auth.captcha]');
    expect(config).toContain('provider = "hcaptcha"');
    expect(productionEnv).toContain('SUPABASE_AUTH_SMTP_HOST=');
    expect(productionEnv).toContain('SUPABASE_AUTH_CAPTCHA_SECRET=');
    expect(productionEnv).not.toMatch(/=.\w{12,}/u);
  });

  test('keeps every Russian Auth and sensitive-action email template in the release contract', () => {
    const config = readRepositoryFile('supabase', 'config.toml');
    const checklist = readRepositoryFile('supabase', 'production-auth-release-checklist.md');
    const templates = [
      'auth-confirmation.html',
      'auth-email-change.html',
      'auth-magic-link.html',
      'auth-recovery.html',
      'auth-password-changed.html',
      'auth-email-changed.html',
      'account-data-cleared.html',
      'account-deleted.html',
    ];

    expect(config).toContain('[auth.email.template.confirmation]');
    expect(config).toContain('[auth.email.template.email_change]');
    expect(config).toContain('[auth.email.template.magic_link]');
    expect(config).toContain('[auth.email.template.recovery]');
    expect(config).toContain('Код для смены или восстановления пароля Plan My Plan');
    expect(config).toContain('[auth.email.notification.password_changed]');
    expect(config).toContain('[auth.email.notification.email_changed]');
    for (const template of templates) {
      expect(readRepositoryFile('supabase', 'templates', template)).toMatch(/Plan My Plan/u);
    }
    expect(readRepositoryFile('supabase', 'templates', 'auth-recovery.html')).toContain('смены или восстановления пароля');
    expect(checklist).toContain('Require current password when updating');
  });

  test('stores only ticket hashes and consumes tickets atomically for the matching account action', () => {
    const migration = readRepositoryFile('supabase', 'migrations', '20260903010000_auth_protection.sql');

    expect(migration).toContain('create table if not exists public.account_action_tickets');
    expect(migration).toContain('token_hash text not null unique');
    expect(migration).toContain("operation in ('clear_account_data', 'delete_account')");
    expect(migration).toContain('create or replace function public.consume_account_action_ticket');
    expect(migration).toContain('and operation = p_operation');
    expect(migration).toContain('and consumed_at is null');
    expect(migration).toContain('and expires_at > now()');
  });

  test('keeps account deletion durable, blocks new cloud writes and clears data in one database transaction', () => {
    const migration = readRepositoryFile('supabase', 'migrations', '20260903020500_account_deletion.sql');
    const functionSource = readRepositoryFile('supabase', 'functions', 'account-data-action', 'index.ts');
    const deletionService = readRepositoryFile('supabase', 'functions', '_shared', 'account-deletion.ts');
    const config = readRepositoryFile('supabase', 'config.toml');

    expect(migration).toContain('create table if not exists public.deletion_requests');
    expect(migration).toContain("status in ('processing', 'retry_required', 'completed')");
    expect(migration).not.toContain('user_id uuid not null references auth.users');
    expect(migration).toContain('create policy "events_block_account_deletion"');
    expect(migration).toContain('create or replace function public.clear_account_business_data');
    expect(migration).toContain('delete from public.events where user_id = p_user_id');
    expect(migration).toContain('set data_generation = data_generation + 1');
    expect(functionSource).toContain("return value === 'clear_account_data' || value === 'delete_account'");
    expect(functionSource).toContain("admin.rpc('clear_account_business_data'");
    expect(functionSource).toContain('admin.auth.admin.deleteUser(userId, false)');
    expect(functionSource).toContain("status: 'retry_required'");
    expect(functionSource).toContain("status: 'completed'");
    expect(deletionService).toContain("return { kind: 'pending', reason: 'auth_delete_failed' }");
    expect(config).toContain('[functions.account-data-action]');
  });

  test('hard-deletes Auth identities and informs the client about a durable pending deletion', () => {
    const functionSource = readRepositoryFile('supabase', 'functions', 'account-data-action', 'index.ts');

    expect(functionSource).toContain('admin.auth.admin.deleteUser(userId, false)');
    expect(functionSource).toContain('return respond({ deletionPending: true }, 202)');
  });

  test('clears the cloud graph while retaining legal acceptance and returns the next generation to the current device', () => {
    const migration = readRepositoryFile('supabase', 'migrations', '20260904030000_account_data_clear.sql');
    const functionSource = readRepositoryFile('supabase', 'functions', 'account-data-action', 'index.ts');

    expect(migration).toContain('delete from public.sync_changes where user_id = p_user_id');
    expect(migration).toContain('delete from public.user_settings where user_id = p_user_id');
    expect(migration).not.toContain('delete from public.legal_acceptances where user_id = p_user_id');
    expect(migration).toContain('set data_generation = data_generation + 1');
    expect(functionSource).toContain('dataGeneration: data');
  });
});
