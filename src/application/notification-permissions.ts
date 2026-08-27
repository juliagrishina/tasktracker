export type NotificationPermissionStatus = 'undetermined' | 'granted' | 'denied';

export interface NotificationPermissionGateway {
  getStatus(): Promise<NotificationPermissionStatus>;
  requestPermission(): Promise<NotificationPermissionStatus>;
}

export interface WebNotificationPermissionGateway extends NotificationPermissionGateway {
  setDemoStatus(status: NotificationPermissionStatus): void;
}

export function createNotificationPermissionService(gateway: NotificationPermissionGateway) {
  return {
    async getStatus() {
      return gateway.getStatus();
    },
    async request() {
      const currentStatus = await gateway.getStatus();
      if (currentStatus === 'granted') return currentStatus;

      return gateway.requestPermission();
    },
  };
}

export function createWebNotificationPermissionGateway(
  initialStatus: NotificationPermissionStatus = 'undetermined',
): WebNotificationPermissionGateway {
  let status = initialStatus;

  return {
    async getStatus() {
      return status;
    },
    async requestPermission() {
      status = 'granted';
      return status;
    },
    setDemoStatus(nextStatus) {
      status = nextStatus;
    },
  };
}
