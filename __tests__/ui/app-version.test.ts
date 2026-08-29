import { resolveAppVersion } from '../../src/ui/settings/app-version';

describe('resolveAppVersion', () => {
  test('prefers the installed native application version over the Expo configuration', () => {
    expect(resolveAppVersion({ expoConfig: { version: '1.0.0' }, nativeAppVersion: '1.2.3' })).toBe('1.2.3');
  });

  test('uses the Expo configuration version when a native build version is unavailable', () => {
    expect(resolveAppVersion({ expoConfig: { version: '1.0.0' }, nativeAppVersion: null })).toBe('1.0.0');
  });
});
