import {
  createNotificationPermissionService,
  createWebNotificationPermissionGateway,
} from '../../src/application/notification-permissions';

describe('notification permissions', () => {
  test('does not ask the device again when local notifications are already allowed', async () => {
    const gateway = {
      getStatus: jest.fn().mockResolvedValue('granted'),
      requestPermission: jest.fn(),
    };
    const service = createNotificationPermissionService(gateway);

    await expect(service.request()).resolves.toBe('granted');
    expect(gateway.requestPermission).not.toHaveBeenCalled();
  });

  test('lets the web prototype simulate both an allowed and a denied state without browser notifications', async () => {
    const gateway = createWebNotificationPermissionGateway();

    await expect(gateway.requestPermission()).resolves.toBe('granted');

    gateway.setDemoStatus('denied');
    await expect(gateway.getStatus()).resolves.toBe('denied');
  });
});
