import type { AppSettings } from '../domain/entities';

export function getDefaultSettings(): AppSettings {
  return {
    workdayStartsAt: '08:00',
    workdayEndsAt: '22:00',
    eveningReviewAt: '21:00',
    notificationLeadMinutes: 10,
  };
}
