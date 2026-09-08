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
  });

  test('verifies EAS preview values before publishing a QA update', () => {
    const packageJson = JSON.parse(readRepositoryFile('package.json')) as {
      scripts?: Record<string, string>;
    };
    const remoteGuard = readRepositoryFile('tools', 'eas', 'verify-eas-qa-environment.mjs');

    expect(packageJson.scripts?.['qa:publish']).toContain('qa:verify');
    expect(packageJson.scripts?.['qa:publish']).toContain('verify-eas-qa-environment.mjs');
    expect(packageJson.scripts?.['qa:publish']).toContain('--channel qa --environment preview');
    expect(remoteGuard).toContain('eas-cli@latest');
    expect(remoteGuard).toContain('env:pull');
    expect(remoteGuard).toContain('https://zwckrqbdepgvenanyans.supabase.co');
    expect(remoteGuard).toContain('rmSync');
  });
});
