import Constants from 'expo-constants';

interface AppVersionSource {
  expoConfig?: { version?: string } | null;
  nativeAppVersion?: string | null;
}

export function resolveAppVersion(source: AppVersionSource): string {
  return source.nativeAppVersion ?? source.expoConfig?.version ?? 'недоступна';
}

export function getAppVersion(): string {
  return resolveAppVersion(Constants);
}
