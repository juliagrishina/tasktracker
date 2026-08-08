import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';

import { designTokens } from '../design/tokens';

type StatusPillTone = 'neutral' | 'info' | 'success' | 'warning';

interface StatusPillProps {
  label: string;
  tone: StatusPillTone;
}

export function StatusPill({ label, tone }: StatusPillProps) {
  return (
    <View accessibilityLabel={label} accessibilityRole="text" style={[styles.base, toneStyles[tone].container]}>
      <Text style={[styles.label, toneStyles[tone].label]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: designTokens.radius.pill,
    paddingHorizontal: designTokens.space[8],
    paddingVertical: designTokens.space[4],
  },
  label: {
    fontSize: designTokens.typography.size.micro,
    lineHeight: designTokens.typography.lineHeight.micro,
    fontWeight: designTokens.typography.weight.bold,
  },
});

const toneStyles: Record<StatusPillTone, { container: ViewStyle; label: TextStyle }> = {
  neutral: {
    container: { backgroundColor: designTokens.color.surface.subtle },
    label: { color: designTokens.color.text.secondary },
  },
  info: {
    container: { backgroundColor: designTokens.color.primarySoft },
    label: { color: designTokens.color.primaryStrong },
  },
  success: {
    container: { backgroundColor: designTokens.color.feedback.success.surface },
    label: { color: designTokens.color.feedback.success.foreground },
  },
  warning: {
    container: { backgroundColor: designTokens.color.feedback.warning.surface },
    label: { color: designTokens.color.feedback.warning.foreground },
  },
};
