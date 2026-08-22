import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

interface PlanPeriodNavigatorProps {
  label: string;
  nextAccessibilityLabel: string;
  onNext: () => void;
  onPrevious: () => void;
  onToday: () => void;
  previousAccessibilityLabel: string;
}

export function PlanPeriodNavigator({
  label,
  nextAccessibilityLabel,
  onNext,
  onPrevious,
  onToday,
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
      <View style={styles.labelGroup}>
        <Text style={styles.label}>{label}</Text>
        <Pressable
          accessibilityLabel="Перейти к сегодняшнему дню"
          accessibilityRole="button"
          onPress={onToday}
          style={({ pressed }) => [styles.today, pressed && styles.pressed]}>
          <Text style={styles.todayText}>Сегодня</Text>
        </Pressable>
      </View>
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
  labelGroup: {
    alignItems: 'center',
    gap: designTokens.space[2],
  },
  today: {
    minHeight: designTokens.size.touchTargetMin,
    justifyContent: 'center',
    paddingHorizontal: designTokens.space[8],
  },
  todayText: {
    color: designTokens.color.primaryStrong,
    fontSize: designTokens.typography.size.meta,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  pressed: {
    opacity: designTokens.state.pressedOpacity,
  },
});
