import type { AppSettings } from '../domain/entities';

export function getDefaultSettings(): AppSettings {
  return {
    timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    workdayStartsAt: '08:00',
    workdayEndsAt: '22:00',
    eveningReviewAt: '21:00',
    eveningReviewNotificationId: null,
    notificationLeadMinutes: 10,
  };
}
