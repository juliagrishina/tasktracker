import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

interface PlanPeriodNavigatorProps {
  label: string;
  nextAccessibilityLabel: string;
  onNext: () => void;
  onPrevious: () => void;
  previousAccessibilityLabel: string;
}

export function PlanPeriodNavigator({
  label,
  nextAccessibilityLabel,
  onNext,
  onPrevious,
  previousAccessibilityLabel,
}: PlanPeriodNavigatorProps) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={previousAccessibilityLabel}
        accessibilityRole="button"
        onPress={onPrevious}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
        <Ionicons color={designTokens.color.text.primary} name="chevron-back" size={20} />
      </Pressable>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityLabel={nextAccessibilityLabel}
        accessibilityRole="button"
        onPress={onNext}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
        <Ionicons color={designTokens.color.text.primary} name="chevron-forward" size={20} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  arrow: {
    alignItems: 'center',
    borderRadius: designTokens.radius.pill,
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
    minWidth: designTokens.size.touchTargetMin,
  },
  label: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  pressed: {
    opacity: designTokens.state.pressedOpacity,
  },
});
