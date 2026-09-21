const guard = jest.requireActual<{
  inspectStaticExport(directory: string, expectedPublicSupabaseUrl?: string): Promise<void>;
  parseDotenv(source: string): Record<string, string>;
  validateStagingEnvironment(values: Record<string, string>, contract: { publicVariableNames: string[]; supabaseUrl: string }): void;
}>('../scripts/verify-qa-staging-config.cjs');

const fileSystem = jest.requireActual<{
  mkdtemp(prefix: string): Promise<string>;
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>;
  writeFile(path: string, data: string): Promise<void>;
}>('node:fs/promises');
const operatingSystem = jest.requireActual<{ tmpdir(): string }>('node:os');
const path = jest.requireActual<{ join(...paths: string[]): string }>('node:path');

const contract = {
  publicVariableNames: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
  supabaseUrl: 'https://staging.example.supabase.co',
};

describe('QA staging deploy guard', () => {
  test('accepts the two reviewed public staging variables', () => {
    const values = guard.parseDotenv([
      'export EXPO_PUBLIC_SUPABASE_URL="https://staging.example.supabase.co"',
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_key=with_equals',
    ].join('\n'));

    expect(() => guard.validateStagingEnvironment(values, contract)).not.toThrow();
  });

  test.each([
    ['a mismatched origin', { EXPO_PUBLIC_SUPABASE_URL: 'https://production.example.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_key' }, 'EXPO_PUBLIC_SUPABASE_URL'],
    ['a non-HTTPS origin', { EXPO_PUBLIC_SUPABASE_URL: 'http://staging.example.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_key' }, 'EXPO_PUBLIC_SUPABASE_URL'],
    ['a missing publishable key', { EXPO_PUBLIC_SUPABASE_URL: 'https://staging.example.supabase.co' }, 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
    ['a server role key', { EXPO_PUBLIC_SUPABASE_URL: 'https://staging.example.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_key', SUPABASE_SERVICE_ROLE_KEY: 'not-printed' }, 'SUPABASE_SERVICE_ROLE_KEY'],
    ['an SMTP credential', { EXPO_PUBLIC_SUPABASE_URL: 'https://staging.example.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_key', SMTP_PASSWORD: 'not-printed' }, 'SMTP_PASSWORD'],
  ])('rejects %s without exposing values', (_caseName, values, expectedVariableName) => {
    expect(() => guard.validateStagingEnvironment(values, contract)).toThrow(expectedVariableName);
  });

  test('accepts a static shell export', async () => {
    const directory = await fileSystem.mkdtemp(path.join(operatingSystem.tmpdir(), 'tasktracker-staging-'));
    try {
      await fileSystem.mkdir(path.join(directory, '_expo', 'static', 'js'), { recursive: true });
      await fileSystem.writeFile(path.join(directory, 'index.html'), '<!doctype html>');
      await fileSystem.writeFile(path.join(directory, 'manifest.json'), '{}');
      await fileSystem.writeFile(path.join(directory, 'sw.js'), 'self.addEventListener("install", () => undefined)');
      await fileSystem.writeFile(
        path.join(directory, '_expo', 'static', 'js', 'entry.js'),
        'const url = "https://staging.example.supabase.co"; const prefix = "sb_secret_"; console.log(url, prefix)',
      );

      await expect(guard.inspectStaticExport(directory, contract.supabaseUrl)).resolves.toBeUndefined();
    } finally {
      await fileSystem.rm(directory, { recursive: true, force: true });
    }
  });

  test('rejects a static shell export without the reviewed public Supabase URL', async () => {
    const directory = await fileSystem.mkdtemp(path.join(operatingSystem.tmpdir(), 'tasktracker-staging-'));
    try {
      await fileSystem.mkdir(path.join(directory, '_expo', 'static', 'js'), { recursive: true });
      await fileSystem.writeFile(path.join(directory, 'index.html'), '<!doctype html>');
      await fileSystem.writeFile(path.join(directory, 'manifest.json'), '{}');
      await fileSystem.writeFile(path.join(directory, 'sw.js'), 'self.addEventListener("install", () => undefined)');
      await fileSystem.writeFile(path.join(directory, '_expo', 'static', 'js', 'entry.js'), 'console.log("shell")');

      await expect(guard.inspectStaticExport(directory, contract.supabaseUrl)).rejects.toThrow('Missing reviewed public Supabase URL');
    } finally {
      await fileSystem.rm(directory, { recursive: true, force: true });
    }
  });

  test.each([
    ['a source map', 'entry.js.map', '{}', 'Source maps'],
    ['a Supabase secret key', 'entry.js', `const key = "sb_secret_${'a'.repeat(32)}";`, 'forbidden server-secret marker'],
  ])('rejects export with %s', async (_caseName, fileName, content, expectedError) => {
    const directory = await fileSystem.mkdtemp(path.join(operatingSystem.tmpdir(), 'tasktracker-staging-'));
    try {
      await fileSystem.mkdir(path.join(directory, '_expo', 'static', 'js'), { recursive: true });
      await fileSystem.writeFile(path.join(directory, 'index.html'), '<!doctype html>');
      await fileSystem.writeFile(path.join(directory, 'manifest.json'), '{}');
      await fileSystem.writeFile(path.join(directory, 'sw.js'), 'self.addEventListener("install", () => undefined)');
      await fileSystem.writeFile(path.join(directory, '_expo', 'static', 'js', 'entry.js'), 'console.log("shell")');
      await fileSystem.writeFile(path.join(directory, '_expo', 'static', 'js', fileName), content);

      await expect(guard.inspectStaticExport(directory)).rejects.toThrow(expectedError);
    } finally {
      await fileSystem.rm(directory, { recursive: true, force: true });
    }
  });
});
