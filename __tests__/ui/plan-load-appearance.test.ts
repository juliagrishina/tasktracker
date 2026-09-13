import { designTokens } from '../../src/ui/design/tokens';
import { getPlanLoadAppearance } from '../../src/ui/plan/plan-load-appearance';

describe('plan load appearance', () => {
  test('uses the danger colour consistently for a high load', () => {
    expect(getPlanLoadAppearance('high')).toEqual({
      border: designTokens.color.calendar.load.high.border,
      foreground: designTokens.color.feedback.danger.foreground,
      surface: designTokens.color.calendar.load.high.surface,
    });
  });
});
