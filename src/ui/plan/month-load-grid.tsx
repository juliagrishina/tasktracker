import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

import { formatPlanDate, formatPlanLoadPercent, type PlanLoadDay, type PlanLoadTone, type PlanMonthLoadWeeks } from './plan-period-model';

interface MonthLoadGridProps {
  onSelectDate: (isoDate: string) => void;
  selectedDate: string;
  weeks: PlanMonthLoadWeeks;
}

interface LoadToneStyle {
  border: string;
  foreground: string;
  surface: string;
}

const weekdayHeadings = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

const loadToneStyles: Record<PlanLoadTone, LoadToneStyle> = {
  low: {
    border: designTokens.color.feedback.success.base,
    foreground: designTokens.color.feedback.success.foreground,
    surface: designTokens.color.feedback.success.surface,
  },
  medium: {
    border: designTokens.color.feedback.warning.border,
    foreground: designTokens.color.feedback.warning.foreground,
    surface: designTokens.color.feedback.warning.surface,
  },
  high: {
    border: designTokens.color.calendar.load.high.border,
    foreground: designTokens.color.feedback.danger.foreground,
    surface: designTokens.color.calendar.load.high.surface,
  },
};

export function MonthLoadGrid({ onSelectDate, selectedDate, weeks }: MonthLoadGridProps) {
  return (
    <View>
      <View style={styles.headingRow}>
        {weekdayHeadings.map((heading) => <Text key={heading} style={styles.heading}>{heading}</Text>)}
      </View>
      <View style={styles.grid}>
        {weeks.flatMap((week, weekIndex) => week.map((day, dayIndex) => (
          day === null
            ? <View key={`blank-${weekIndex}-${dayIndex}`} style={styles.blankCell} />
            : <MonthLoadCell day={day} key={day.isoDate} onPress={onSelectDate} selected={day.isoDate === selectedDate} />
        )))}
      </View>
    </View>
  );
}

function MonthLoadCell({ day, onPress, selected }: { day: PlanLoadDay; onPress: (isoDate: string) => void; selected: boolean }) {
  const [isFocused, setIsFocused] = useState(false);
  const tone = loadToneStyles[day.tone];
  const displayedLoad = formatPlanLoadPercent(day.loadPercent);
  const label = `${formatPlanDate(day.isoDate)}: загрузка ${displayedLoad}%`;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={() => onPress(day.isoDate)}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor: tone.surface, borderColor: selected ? designTokens.color.primary : tone.border },
        isFocused && styles.focusedCell,
        pressed && styles.pressed,
      ]}>
      <Text style={styles.dayNumber}>{day.dayOfMonth}</Text>
      <Text style={[styles.load, { color: tone.foreground }]}>{displayedLoad}%</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: 'row',
    gap: designTokens.space[4],
    marginBottom: designTokens.space[6],
  },
  heading: {
    color: designTokens.color.text.secondary,
    flex: 1,
    fontSize: designTokens.typography.size.micro,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.micro,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: designTokens.space[4],
  },
  cell: {
    borderRadius: designTokens.radius.compact,
    borderWidth: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '13%',
    justifyContent: 'space-between',
    minHeight: designTokens.size.touchTargetMin + designTokens.space[12],
    padding: designTokens.space[6],
  },
  blankCell: {
    flexBasis: '13%',
    flexGrow: 1,
    flexShrink: 1,
    minHeight: designTokens.size.touchTargetMin + designTokens.space[12],
  },
  dayNumber: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  load: {
    fontSize: designTokens.typography.size.micro,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.micro,
  },
  focusedCell: {
    outlineColor: designTokens.color.primary,
    outlineOffset: 2,
    outlineStyle: 'solid',
    outlineWidth: 3,
  },
  pressed: {
    opacity: designTokens.state.pressedOpacity,
  },
});
