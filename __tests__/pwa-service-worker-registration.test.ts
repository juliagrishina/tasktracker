import { serviceWorkerRegistrationScript } from '../src/pwa/service-worker-registration';

const fileSystem = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('node:fs');

describe('PWA service worker registration', () => {
  test('activates an updated worker and reloads only a previously controlled client', () => {
    expect(serviceWorkerRegistrationScript).toContain("'serviceWorker' in navigator");
    expect(serviceWorkerRegistrationScript).toContain("window.addEventListener('load'");
    expect(serviceWorkerRegistrationScript).toContain("register('/sw.js', { updateViaCache: 'none' })");
    expect(serviceWorkerRegistrationScript).toContain("navigator.serviceWorker.addEventListener('controllerchange'");
    expect(serviceWorkerRegistrationScript).toContain("worker.postMessage({ type: 'SKIP_WAITING' })");
    expect(serviceWorkerRegistrationScript).toContain("registration.addEventListener('updatefound'");
    expect(serviceWorkerRegistrationScript).toContain('window.location.reload()');
    expect(serviceWorkerRegistrationScript).toContain('.catch(() => undefined)');
  });

  test('injects the registration snippet into the web HTML entry', () => {
    const htmlEntry = fileSystem.readFileSync(`${process.cwd()}/src/app/+html.tsx`, 'utf8');

    expect(htmlEntry).toContain('serviceWorkerRegistrationScript');
    expect(htmlEntry).toContain('dangerouslySetInnerHTML');
  });
});
