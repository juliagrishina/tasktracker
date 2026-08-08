import { Pressable, StyleSheet, Text } from 'react-native';

import { designTokens } from '../design/tokens';

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  tone: 'primary' | 'soft' | 'secondary' | 'danger';
  disabled?: boolean;
}

export function ActionButton({ label, onPress, tone, disabled = false }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        toneStyles[tone].container,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Text style={[styles.label, toneStyles[tone].label]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: designTokens.size.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designTokens.radius.control,
    paddingHorizontal: designTokens.space[12],
  },
  label: {
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
    fontWeight: designTokens.typography.weight.bold,
  },
  pressed: {
    opacity: designTokens.state.pressedOpacity,
  },
  disabled: {
    opacity: designTokens.state.disabledOpacity,
  },
});

const toneStyles = StyleSheet.create({
  primary: {
    container: { backgroundColor: designTokens.color.primary },
    label: { color: designTokens.color.text.inverse },
  },
  soft: {
    container: { backgroundColor: designTokens.color.primarySoft },
    label: { color: designTokens.color.primaryStrong },
  },
  secondary: {
    container: { backgroundColor: designTokens.color.surface.subtle },
    label: { color: designTokens.color.text.primary },
  },
  danger: {
    container: {
      borderWidth: 1,
      borderColor: designTokens.color.feedback.danger.foreground,
      backgroundColor: designTokens.color.surface.raised,
    },
    label: { color: designTokens.color.feedback.danger.foreground },
  },
});
