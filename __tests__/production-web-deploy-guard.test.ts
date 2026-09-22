const productionGuard = jest.requireActual<{
  runVerification(options: {
    envFile: string;
    distDirectory?: string;
    inspectDist: boolean;
  }): Promise<void>;
}>('../scripts/verify-production-web-config.cjs');

const fileSystem = jest.requireActual<{
  mkdtemp(prefix: string): Promise<string>;
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>;
  writeFile(path: string, data: string): Promise<void>;
}>('node:fs/promises');
const operatingSystem = jest.requireActual<{ tmpdir(): string }>('node:os');
const path = jest.requireActual<{ join(...paths: string[]): string }>('node:path');

describe('production web deploy guard', () => {
  test('accepts only the reviewed production Supabase origin', async () => {
    const directory = await fileSystem.mkdtemp(path.join(operatingSystem.tmpdir(), 'tasktracker-production-'));
    const envFile = path.join(directory, '.env.local');

    try {
      await fileSystem.writeFile(envFile, [
        'EXPO_PUBLIC_SUPABASE_URL=https://lskslmsqjrgbbgvzdoqs.supabase.co',
        'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_key',
      ].join('\n'));

      await expect(productionGuard.runVerification({ envFile, inspectDist: false })).resolves.toBeUndefined();
    } finally {
      await fileSystem.rm(directory, { recursive: true, force: true });
    }
  });

  test('rejects a staging origin before the production export starts', async () => {
    const directory = await fileSystem.mkdtemp(path.join(operatingSystem.tmpdir(), 'tasktracker-production-'));
    const envFile = path.join(directory, '.env.local');

    try {
      await fileSystem.writeFile(envFile, [
        'EXPO_PUBLIC_SUPABASE_URL=https://staging.example.supabase.co',
        'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_key',
      ].join('\n'));

      await expect(productionGuard.runVerification({ envFile, inspectDist: false })).rejects.toThrow('EXPO_PUBLIC_SUPABASE_URL');
    } finally {
      await fileSystem.rm(directory, { recursive: true, force: true });
    }
  });

  test('requires the reviewed production origin in the exported shell', async () => {
    const directory = await fileSystem.mkdtemp(path.join(operatingSystem.tmpdir(), 'tasktracker-production-'));
    const envFile = path.join(directory, '.env.local');
    const distDirectory = path.join(directory, 'dist');

    try {
      await fileSystem.mkdir(path.join(distDirectory, '_expo', 'static', 'js'), { recursive: true });
      await fileSystem.writeFile(envFile, [
        'EXPO_PUBLIC_SUPABASE_URL=https://lskslmsqjrgbbgvzdoqs.supabase.co',
        'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_key',
      ].join('\n'));
      await fileSystem.writeFile(path.join(distDirectory, 'index.html'), '<!doctype html>');
      await fileSystem.writeFile(path.join(distDirectory, 'manifest.json'), '{}');
      await fileSystem.writeFile(path.join(distDirectory, 'sw.js'), 'self.addEventListener("install", () => undefined)');
      await fileSystem.writeFile(
        path.join(distDirectory, '_expo', 'static', 'js', 'entry.js'),
        'const url = "https://lskslmsqjrgbbgvzdoqs.supabase.co";',
      );

      await expect(productionGuard.runVerification({
        envFile,
        distDirectory,
        inspectDist: true,
      })).resolves.toBeUndefined();
    } finally {
      await fileSystem.rm(directory, { recursive: true, force: true });
    }
  });
});
