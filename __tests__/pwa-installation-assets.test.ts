import manifest from '../public/manifest.json';

const appConfig = require('../app.json') as { expo: Record<string, unknown> };

describe('PWA installation assets', () => {
  test('configures iPhone, browser, and PWA icons', () => {
    const expo = appConfig.expo as {
      icon?: string;
      ios?: { icon?: string };
      web?: { favicon?: string };
    };

    expect(expo.icon).toBe('./assets/plan-my-plan-512.png');
    expect(expo.ios?.icon).toBe('./assets/plan-my-plan-512.png');
    expect(expo.web?.favicon).toBe('./public/favicon.png');

    const pwaManifest = manifest as {
      display?: string;
      icons?: { src: string; sizes: string }[];
    };
    expect(pwaManifest.display).toBe('standalone');
    expect(pwaManifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/icon-192.png', sizes: '192x192' }),
      expect.objectContaining({ src: '/icon-512.png', sizes: '512x512' }),
    ]));
  });
});
