export const serviceWorkerRegistrationScript = `
if ('serviceWorker' in navigator) {
  const wasControlledAtLoad = navigator.serviceWorker.controller !== null;
  let didReloadForWorkerUpdate = false;

  const activateWaitingWorker = (worker) => {
    if (worker !== null) worker.postMessage({ type: 'SKIP_WAITING' });
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!wasControlledAtLoad || didReloadForWorkerUpdate) return;
    didReloadForWorkerUpdate = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        activateWaitingWorker(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (worker === null) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller !== null) {
              activateWaitingWorker(worker);
            }
          });
        });
      })
      .catch(() => undefined);
  });
}
`;
