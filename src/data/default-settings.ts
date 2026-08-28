import type { AppSettings } from '../domain/entities';

export function getDeviceTimeZoneId(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

export function resolveTimeZoneId(
  settings: Pick<AppSettings, 'timeZoneId' | 'timeZoneMode'>,
  deviceTimeZoneId = getDeviceTimeZoneId(),
): string {
  return settings.timeZoneMode === 'device' ? deviceTimeZoneId : settings.timeZoneId;
}

export function getDefaultSettings(): AppSettings {
  return {
    timeZoneId: getDeviceTimeZoneId(),
    timeZoneMode: 'device',
    workdayStartsAt: '08:00',
    workdayEndsAt: '22:00',
    eveningReviewAt: '21:00',
    eveningReviewNotificationId: null,
    notificationLeadMinutes: 10,
  };
}
