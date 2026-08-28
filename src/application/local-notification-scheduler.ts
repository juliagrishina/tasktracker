import { Platform } from 'react-native';

import type { LocalNotificationScheduler } from './notification-scheduling';

let nextWebNotificationId = 0;

export const localNotificationScheduler: LocalNotificationScheduler = {
  async cancel(notificationId) {
    if (Platform.OS === 'web') return;
    const Notifications = await import('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  },
  async schedule(input) {
    if (Platform.OS === 'web') {
      nextWebNotificationId += 1;
      return `web-notification-${nextWebNotificationId}`;
    }
    const Notifications = await import('expo-notifications');
    return Notifications.scheduleNotificationAsync({
      content: { title: input.title, body: input.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(input.scheduledAt) },
    });
  },
};
