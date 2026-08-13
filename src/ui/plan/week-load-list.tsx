import { StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';
import { SurfaceCard } from '../primitives/surface-card';

import { formatPlanDate, formatPlanLoadPercent, type PlanLoadDay, type PlanLoadTone } from './plan-period-model';

interface WeekLoadListProps {
  days: readonly PlanLoadDay[];
  onSelectDate: (isoDate: string) => void;
  selectedDate: string;
}

interface LoadToneStyle {
  foreground: string;
  surface: string;
}

const loadToneStyles: Record<PlanLoadTone, LoadToneStyle> = {
  low: {
    foreground: designTokens.color.feedback.success.foreground,
    surface: designTokens.color.feedback.success.surface,
  },
  medium: {
    foreground: designTokens.color.feedback.warning.foreground,
    surface: designTokens.color.feedback.warning.surface,
  },
  high: {
    foreground: designTokens.color.feedback.danger.foreground,
    surface: designTokens.color.calendar.load.high.surface,
  },
};

export function WeekLoadList({ days, onSelectDate, selectedDate }: WeekLoadListProps) {
  return (
    <View style={styles.list}>
      {days.map((day) => {
        const loadStyle = loadToneStyles[day.tone];
        const selected = day.isoDate === selectedDate;
        const displayedLoad = formatPlanLoadPercent(day.loadPercent);
        const label = `${day.weekdayLabel}, ${formatPlanDate(day.isoDate)}: загрузка ${displayedLoad}%`;

        return (
          <SurfaceCard
            accessibilityLabel={label}
            key={day.isoDate}
            onPress={() => onSelectDate(day.isoDate)}
            style={[styles.row, selected && styles.selectedRow]}>
            <View style={[styles.dateBadge, selected && styles.selectedDateBadge]}>
              <Text style={[styles.dateNumber, selected && styles.selectedDateNumber]}>{day.dayOfMonth}</Text>
            </View>
            <View style={styles.copy}>
              <View style={styles.copyHeader}>
                <Text style={styles.weekday}>{day.weekdayLabel}</Text>
                <Text style={[styles.loadText, { color: loadStyle.foreground }]}>{displayedLoad}%</Text>
              </View>
              <Text style={styles.date}>{formatPlanDate(day.isoDate)}</Text>
              <View style={styles.track}>
                <View
                  style={[
                    styles.progress,
                    { backgroundColor: loadStyle.foreground, width: `${Math.min(day.loadPercent, 100)}%` },
                  ]}
                />
              </View>
            </View>
          </SurfaceCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: designTokens.space[8],
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: designTokens.space[12],
    padding: designTokens.space[12],
  },
  selectedRow: {
    borderColor: designTokens.color.primary,
  },
  dateBadge: {
    alignItems: 'center',
    backgroundColor: designTokens.color.surface.subtle,
    borderRadius: designTokens.radius.pill,
    height: designTokens.size.touchTargetMin,
    justifyContent: 'center',
    width: designTokens.size.touchTargetMin,
  },
  selectedDateBadge: {
    backgroundColor: designTokens.color.primary,
  },
  dateNumber: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  selectedDateNumber: {
    color: designTokens.color.text.inverse,
  },
  copy: {
    flex: 1,
  },
  copyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekday: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  loadText: {
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  date: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
    marginTop: designTokens.space[2],
  },
  track: {
    backgroundColor: designTokens.color.calendar.progressTrack,
    borderRadius: designTokens.radius.pill,
    height: designTokens.space[6],
    marginTop: designTokens.space[8],
    overflow: 'hidden',
  },
  progress: {
    borderRadius: designTokens.radius.pill,
    height: '100%',
  },
});
