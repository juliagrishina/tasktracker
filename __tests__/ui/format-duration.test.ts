import { formatDuration } from '../../src/ui/format-duration';

describe('formatDuration', () => {
  test.each([
    [55, '55 мин'],
    [60, '1 ч'],
    [65, '1 ч 5 мин'],
    [120, '2 ч'],
    [150, '2 ч 30 мин'],
  ])('renders %i minutes as %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});
