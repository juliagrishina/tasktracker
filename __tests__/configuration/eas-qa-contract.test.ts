function readRepositoryFile(...segments: string[]): string {
  const fileSystem = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('node:fs');
  return fileSystem.readFileSync(`${process.cwd()}/${segments.join('/')}`, 'utf8');
}

describe('EAS QA delivery contract', () => {
  test('defines a staging-only local QA verification entry point', () => {
    const packageJson = JSON.parse(readRepositoryFile('package.json')) as {
      scripts?: Record<string, string>;
    };
    const guard = readRepositoryFile('tools', 'eas', 'verify-qa-staging.mjs');

    expect(packageJson.scripts?.['qa:verify']).toBe('node tools/eas/verify-qa-staging.mjs');
    expect(guard).toContain('https://zwckrqbdepgvenanyans.supabase.co');
    expect(guard).toContain("ensureIgnored('.env.local')");
    expect(guard).toContain('The local QA environment must contain only the two approved public staging variables.');
  });

  test('verifies EAS preview values before publishing a QA update', () => {
    const packageJson = JSON.parse(readRepositoryFile('package.json')) as {
      scripts?: Record<string, string>;
    };
    const remoteGuard = readRepositoryFile('tools', 'eas', 'verify-eas-qa-environment.mjs');

    expect(packageJson.scripts?.['qa:publish']).toContain('qa:verify');
    expect(packageJson.scripts?.['qa:publish']).toContain('verify-eas-qa-environment.mjs');
    expect(packageJson.scripts?.['qa:publish']).toContain('npx --offline --yes eas-cli@latest');
    expect(packageJson.scripts?.['qa:publish']).toContain('--channel qa --environment preview');
    expect(remoteGuard).toContain('eas-cli@latest');
    expect(remoteGuard).toContain("'--offline'");
    expect(remoteGuard).toContain('env:pull');
    expect(remoteGuard).toContain('https://zwckrqbdepgvenanyans.supabase.co');
    expect(remoteGuard).toContain("process.env.ComSpec ?? 'cmd.exe'");
    expect(remoteGuard).not.toContain('shell: true');
    expect(remoteGuard).toContain('rmSync');
  });

  test('contains only the permanent QA EAS Update configuration', () => {
    const appConfig = require('../../app.json') as { expo: Record<string, unknown> };
    const easConfig = JSON.parse(readRepositoryFile('eas.json')) as {
      build?: Record<string, { channel?: string; environment?: string }>;
    };
    const packageJson = JSON.parse(readRepositoryFile('package.json')) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.['expo-updates']).toMatch(/^~57\./u);
    expect(appConfig.expo.updates).toEqual(expect.objectContaining({ url: expect.stringMatching(/^https:\/\/u\.expo\.dev\//u) }));
    expect(appConfig.expo.runtimeVersion).toEqual({ policy: 'appVersion' });
    expect(easConfig.build).toEqual({ qa: expect.objectContaining({ channel: 'qa', environment: 'preview' }) });
  });

  test('documents staging-only preparation and explicit QA publication', () => {
    const guide = readRepositoryFile('docs', 'operations', 'eas-qa-update.md');

    expect(guide).toContain('zwckrqbdepgvenanyans');
    expect(guide).toContain('npm run qa:verify');
    expect(guide).toContain('npm run qa:publish');
    expect(guide).toContain('--channel qa --environment preview');
    expect(guide).toContain('не публикуйте без явного запроса');
    expect(guide).toContain('planmeplan.ru');
  });
});
