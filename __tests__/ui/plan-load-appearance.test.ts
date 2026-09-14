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

  test('uses a distinct orange tone for a medium load', () => {
    expect(getPlanLoadAppearance('medium')).toEqual({
      border: '#F5B27B',
      foreground: '#E05A00',
      surface: '#FFF0E8',
    });
  });
});
