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
});
