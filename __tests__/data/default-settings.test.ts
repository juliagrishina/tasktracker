import { getDefaultSettings } from '../../src/data/default-settings';

describe('default settings', () => {
  test('returns the approved planning defaults', () => {
    expect(getDefaultSettings()).toMatchObject({
      workdayStartsAt: '08:00',
      workdayEndsAt: '22:00',
      eveningReviewAt: '21:00',
      notificationLeadMinutes: 10,
    });
    expect(() => new Intl.DateTimeFormat('en-US', { timeZone: getDefaultSettings().timeZoneId })).not.toThrow();
  });
});
