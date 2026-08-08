import { designTokens } from '../../src/ui/design/tokens';

describe('designTokens', () => {
  test('preserves the approved primary, surface and touch-target tokens', () => {
    expect(designTokens.color.primary).toBe('#0A84FF');
    expect(designTokens.color.surface.canvas).toBe('#F5F7FA');
    expect(designTokens.size.touchTargetMin).toBe(44);
    expect(designTokens.radius.card).toBe(18);
  });

  test('keeps success, warning, danger and meeting semantic tones distinct', () => {
    expect(designTokens.color.feedback.success.surface).toBe('#D9F7E2');
    expect(designTokens.color.feedback.warning.surface).toBe('#FFF3CF');
    expect(designTokens.color.feedback.danger.foreground).toBe('#D83931');
    expect(designTokens.color.meeting.surface).toBe('#E9EEF6');
  });
});
