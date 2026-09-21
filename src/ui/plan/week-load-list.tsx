import { StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';
import { SurfaceCard } from '../primitives/surface-card';

import { formatPlanDate, type PlanLoadDay } from './plan-period-model';
import { getPlanLoadAppearance } from './plan-load-appearance';

interface WeekLoadListProps {
  days: PlanLoadDay[];
  onSelectDate: (isoDate: string) => void;
  selectedDate: string;
  todayDate: string;
}

export function WeekLoadList({ days, onSelectDate, selectedDate, todayDate }: WeekLoadListProps) {
  return (
    <View style={styles.list}>
      {days.map((day) => {
        const loadStyle = getPlanLoadAppearance(day.tone);
        const selected = day.isoDate === selectedDate;
        const isToday = day.isoDate === todayDate;
        const label = `${day.weekdayLabel}, ${formatPlanDate(day.isoDate)}: загрузка ${day.loadPercent}%${isToday ? ', сегодня' : ''}`;

        return (
          <SurfaceCard
            accessibilityLabel={label}
            key={day.isoDate}
            onPress={() => onSelectDate(day.isoDate)}
            style={[styles.row, { backgroundColor: loadStyle.surface, borderColor: loadStyle.border }, isToday && styles.todayRow, selected && styles.selectedRow]}>
            <View style={[styles.dateBadge, isToday && styles.todayDateBadge, selected && styles.selectedDateBadge]}>
              <Text style={[styles.dateNumber, selected && styles.selectedDateNumber]}>{day.dayOfMonth}</Text>
            </View>
            <View style={styles.copy}>
              <View style={styles.copyHeader}>
                <Text style={styles.weekday}>{day.weekdayLabel}</Text>
                <Text style={[styles.loadText, { color: loadStyle.foreground }]}>{day.loadPercent}%</Text>
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
  todayRow: {
    borderColor: designTokens.color.primaryStrong,
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
  todayDateBadge: {
    borderColor: designTokens.color.primaryStrong,
    borderWidth: 2,
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
