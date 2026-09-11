const { createPwaServiceWorkerConfig } = jest.requireActual<{
  createPwaServiceWorkerConfig(directory: string): Record<string, unknown>;
}>('../scripts/generate-pwa-service-worker.cjs');

const childProcess = jest.requireActual<{
  execFile(
    file: string,
    args: string[],
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ): unknown;
}>('node:child_process');
const fileSystem = jest.requireActual<{
  mkdtemp(prefix: string): Promise<string>;
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  readdir(path: string): Promise<string[]>;
  readFile(path: string, encoding: string): Promise<string>;
  rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>;
  writeFile(path: string, data: string): Promise<void>;
}>('node:fs/promises');
const operatingSystem = jest.requireActual<{ tmpdir(): string }>('node:os');
const path = jest.requireActual<{ join(...paths: string[]): string }>('node:path');

function runNode(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    childProcess.execFile(process.execPath, args, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

describe('PWA service worker build', () => {
  test('creates a non-claiming static-only Workbox configuration', () => {
    const config = createPwaServiceWorkerConfig('C:/tmp/dist');

    expect(config).toMatchObject({
      globDirectory: 'C:/tmp/dist',
      swDest: path.join('C:/tmp/dist', 'sw.js'),
      cleanupOutdatedCaches: true,
      inlineWorkboxRuntime: true,
      skipWaiting: false,
      clientsClaim: false,
    });
    expect(config).not.toHaveProperty('runtimeCaching');
    expect(config).not.toHaveProperty('navigateFallback');
    expect(config.globIgnores).toEqual(expect.arrayContaining(['sw.js', '**/*.map']));
  });

  test('writes a worker for static export files only', async () => {
    const directory = await fileSystem.mkdtemp(path.join(operatingSystem.tmpdir(), 'tasktracker-pwa-'));

    try {
      await fileSystem.mkdir(path.join(directory, '_expo', 'static', 'js'), { recursive: true });
      await fileSystem.writeFile(path.join(directory, 'index.html'), '<!doctype html>');
      await fileSystem.writeFile(path.join(directory, 'manifest.json'), '{}');
      await fileSystem.writeFile(path.join(directory, '_expo', 'static', 'js', 'entry.js'), 'console.log(1)');

      const scriptPath = path.join(process.cwd(), 'scripts', 'generate-pwa-service-worker.cjs');
      const command = `const { generatePwaServiceWorker } = require(${JSON.stringify(scriptPath)}); generatePwaServiceWorker(${JSON.stringify(directory)}).then((result) => process.stdout.write(JSON.stringify(result))).catch((error) => { console.error(error); process.exitCode = 1; });`;
      const stdout = await runNode(['-e', command]);
      const result = JSON.parse(stdout) as { count: number };
      const worker = await fileSystem.readFile(path.join(directory, 'sw.js'), 'utf8');

      expect(result.count).toBeGreaterThanOrEqual(3);
      expect(worker).toContain('index.html');
      expect(worker).toContain('manifest.json');
      expect(worker).toContain('entry.js');
      expect(await fileSystem.readdir(directory)).not.toEqual(expect.arrayContaining([expect.stringMatching(/^workbox-/)]));
    } finally {
      await fileSystem.rm(directory, { recursive: true, force: true });
    }
  }, 20_000);
});
