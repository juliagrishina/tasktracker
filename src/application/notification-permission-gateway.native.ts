import * as Notifications from 'expo-notifications';

import type { NotificationPermissionGateway, NotificationPermissionStatus } from './notification-permissions';

function toPermissionStatus(status: Notifications.PermissionStatus): NotificationPermissionStatus {
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === Notifications.PermissionStatus.DENIED) return 'denied';

  return 'undetermined';
}

export const notificationPermissionGateway: NotificationPermissionGateway = {
  async getStatus() {
    const permissions = await Notifications.getPermissionsAsync();
    return toPermissionStatus(permissions.status);
  },
  async requestPermission() {
    const permissions = await Notifications.requestPermissionsAsync();
    return toPermissionStatus(permissions.status);
  },
};
