import { designTokens } from '../design/tokens';

import type { PlanLoadTone } from './plan-period-model';

export interface PlanLoadAppearance {
  border: string;
  foreground: string;
  surface: string;
}

export function getPlanLoadAppearance(tone: PlanLoadTone): PlanLoadAppearance {
  if (tone === 'high') {
    return {
      border: designTokens.color.calendar.load.high.border,
      foreground: designTokens.color.feedback.danger.foreground,
      surface: designTokens.color.calendar.load.high.surface,
    };
  }

  if (tone === 'medium') {
    return {
      border: designTokens.color.calendar.load.medium.border,
      foreground: designTokens.color.calendar.load.medium.foreground,
      surface: designTokens.color.calendar.load.medium.surface,
    };
  }

  return {
    border: designTokens.color.feedback.success.base,
    foreground: designTokens.color.feedback.success.foreground,
    surface: designTokens.color.feedback.success.surface,
  };
}
