import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { createPwaServiceWorkerConfig } = require('../scripts/generate-pwa-service-worker.cjs') as {
  createPwaServiceWorkerConfig(directory: string): Record<string, unknown>;
};

const execFile = promisify(execFileCallback);

describe('PWA service worker build', () => {
  test('creates a non-claiming static-only Workbox configuration', () => {
    const config = createPwaServiceWorkerConfig('C:/tmp/dist');

    expect(config).toMatchObject({
      globDirectory: 'C:/tmp/dist',
      swDest: join('C:/tmp/dist', 'sw.js'),
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
    const directory = await mkdtemp(join(tmpdir(), 'tasktracker-pwa-'));

    try {
      await mkdir(join(directory, '_expo', 'static', 'js'), { recursive: true });
      await writeFile(join(directory, 'index.html'), '<!doctype html>');
      await writeFile(join(directory, 'manifest.json'), '{}');
      await writeFile(join(directory, '_expo', 'static', 'js', 'entry.js'), 'console.log(1)');

      const scriptPath = join(process.cwd(), 'scripts', 'generate-pwa-service-worker.cjs');
      const command = `const { generatePwaServiceWorker } = require(${JSON.stringify(scriptPath)}); generatePwaServiceWorker(${JSON.stringify(directory)}).then((result) => process.stdout.write(JSON.stringify(result))).catch((error) => { console.error(error); process.exitCode = 1; });`;
      const { stdout } = await execFile(process.execPath, ['-e', command]);
      const result = JSON.parse(stdout) as { count: number };
      const worker = await readFile(join(directory, 'sw.js'), 'utf8');

      expect(result.count).toBeGreaterThanOrEqual(3);
      expect(worker).toContain('index.html');
      expect(worker).toContain('manifest.json');
      expect(worker).toContain('entry.js');
      expect(await readdir(directory)).not.toEqual(expect.arrayContaining([expect.stringMatching(/^workbox-/)]));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 20_000);
});
