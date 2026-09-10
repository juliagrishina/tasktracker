const path = require('node:path');
const { generateSW } = require('workbox-build');

const defaultDistDirectory = path.resolve(__dirname, '..', 'dist');

function createPwaServiceWorkerConfig(distDirectory = defaultDistDirectory) {
  return {
    globDirectory: distDirectory,
    globPatterns: ['**/*.{html,js,css,json,png,jpg,jpeg,webp,svg,ico,woff,woff2,ttf,otf}'],
    globIgnores: ['sw.js', 'workbox-*.js', '**/*.map'],
    swDest: path.join(distDirectory, 'sw.js'),
    cleanupOutdatedCaches: true,
    inlineWorkboxRuntime: true,
    skipWaiting: false,
    clientsClaim: false,
  };
}

async function generatePwaServiceWorker(distDirectory = defaultDistDirectory) {
  const result = await generateSW(createPwaServiceWorkerConfig(distDirectory));

  if (result.count === 0) {
    throw new Error('PWA service worker requires exported static assets.');
  }

  return result;
}

if (require.main === module) {
  generatePwaServiceWorker().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = { createPwaServiceWorkerConfig, generatePwaServiceWorker };
