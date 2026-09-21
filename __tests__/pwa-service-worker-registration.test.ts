import { serviceWorkerRegistrationScript } from '../src/pwa/service-worker-registration';

const fileSystem = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('node:fs');

describe('PWA service worker registration', () => {
  test('registers the root worker after load without forcing an update', () => {
    expect(serviceWorkerRegistrationScript).toContain("'serviceWorker' in navigator");
    expect(serviceWorkerRegistrationScript).toContain("window.addEventListener('load'");
    expect(serviceWorkerRegistrationScript).toContain("register('/sw.js', { updateViaCache: 'none' })");
    expect(serviceWorkerRegistrationScript).toContain('.catch(() => undefined)');
    expect(serviceWorkerRegistrationScript).not.toContain('skipWaiting');
    expect(serviceWorkerRegistrationScript).not.toContain('clients.claim');
  });

  test('injects the registration snippet into the web HTML entry', () => {
    const htmlEntry = fileSystem.readFileSync(`${process.cwd()}/src/app/+html.tsx`, 'utf8');

    expect(htmlEntry).toContain('serviceWorkerRegistrationScript');
    expect(htmlEntry).toContain('dangerouslySetInnerHTML');
  });
});
