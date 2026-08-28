import {
  getDefaultSettings,
  resolveTimeZoneId,
} from '../../src/data/default-settings';

describe('default settings', () => {
  test('returns the approved planning defaults', () => {
    expect(getDefaultSettings()).toMatchObject({
      workdayStartsAt: '08:00',
      workdayEndsAt: '22:00',
      eveningReviewAt: '21:00',
      notificationLeadMinutes: 10,
      timeZoneMode: 'device',
    });
    expect(() => new Intl.DateTimeFormat('en-US', { timeZone: getDefaultSettings().timeZoneId })).not.toThrow();
  });

  test('uses the device timezone only while automatic mode is active', () => {
    expect(resolveTimeZoneId({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow', timeZoneMode: 'device' }, 'Europe/Berlin')).toBe('Europe/Berlin');
    expect(resolveTimeZoneId({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow', timeZoneMode: 'manual' }, 'Europe/Berlin')).toBe('Europe/Moscow');
  });
});
