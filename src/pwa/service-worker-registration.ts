export const serviceWorkerRegistrationScript = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .catch(() => undefined);
  });
}
`;
