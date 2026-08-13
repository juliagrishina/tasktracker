import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

const monthNames = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
] as const;

const monthNamesGenitive = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export interface PlanningDatePickerProps {
  accessibilityLabel: string;
  maximumValue?: string;
  minimumValue?: string;
  onChange: (isoDate: string) => void;
  onVisibleChange?: (visible: boolean) => void;
  value: string;
  visible?: boolean;
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return null;
  }

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year)
    && date.getMonth() === Number(month) - 1
    && date.getDate() === Number(day)
    ? date
    : null;
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getInitialMonth(value: string, minimumValue?: string, maximumValue?: string): Date {
  const candidate = parseIsoDate(value)
    ?? parseIsoDate(minimumValue ?? '')
    ?? parseIsoDate(maximumValue ?? '')
    ?? new Date();
  return new Date(candidate.getFullYear(), candidate.getMonth(), 1);
}

export function formatPlanningDate(value: string): string {
  const date = parseIsoDate(value);
  if (date === null) {
    return 'Выбрать дату';
  }

  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

function getDayAccessibilityLabel(year: number, month: number, day: number): string {
  return `${day} ${monthNamesGenitive[month]} ${year}`;
}

export function PlanningDatePicker({
  accessibilityLabel,
  maximumValue,
  minimumValue,
  onChange,
  onVisibleChange,
  value,
  visible,
}: PlanningDatePickerProps) {
  const [internalVisible, setInternalVisible] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(() => getInitialMonth(value, minimumValue, maximumValue));
  const isVisible = visible ?? internalVisible;

  const setVisible = (nextVisible: boolean) => {
    setInternalVisible(nextVisible);
    onVisibleChange?.(nextVisible);
  };

  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const days = useMemo(() => {
    const leadingEmptyDays = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array.from({ length: leadingEmptyDays }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(day);
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }, [month, year]);

  const previousMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const minimumMonth = parseIsoDate(minimumValue ?? '');
  const maximumMonth = parseIsoDate(maximumValue ?? '');
  const previousDisabled = minimumMonth !== null
    && previousMonth < new Date(minimumMonth.getFullYear(), minimumMonth.getMonth(), 1);
  const nextDisabled = maximumMonth !== null
    && nextMonth > new Date(maximumMonth.getFullYear(), maximumMonth.getMonth(), 1);
  const monthTitle = `${monthNames[month][0].toUpperCase()}${monthNames[month].slice(1)} ${year}`;

  return (
    <View>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ expanded: isVisible }}
        onPress={() => {
          if (!isVisible) {
            setDisplayMonth(getInitialMonth(value, minimumValue, maximumValue));
          }
          setVisible(!isVisible);
        }}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
        <Ionicons color={designTokens.color.primaryStrong} name="calendar-outline" size={20} />
        <Text style={[styles.triggerText, value === '' && styles.placeholder]}>{formatPlanningDate(value)}</Text>
        <Ionicons
          color={designTokens.color.text.secondary}
          name={isVisible ? 'chevron-up' : 'chevron-down'}
          size={18}
        />
      </Pressable>

      {isVisible ? (
        <View accessibilityLabel={`Календарь: ${monthTitle}`} style={styles.calendar}>
          <View style={styles.monthHeader}>
            <Pressable
              accessibilityLabel="Предыдущий месяц"
              accessibilityRole="button"
              accessibilityState={{ disabled: previousDisabled }}
              disabled={previousDisabled}
              onPress={() => setDisplayMonth(previousMonth)}
              style={({ pressed }) => [
                styles.monthButton,
                pressed && styles.pressed,
                previousDisabled && styles.disabled,
              ]}>
              <Ionicons color={designTokens.color.primaryStrong} name="chevron-back" size={22} />
            </Pressable>
            <Text style={styles.monthTitle}>{monthTitle}</Text>
            <Pressable
              accessibilityLabel="Следующий месяц"
              accessibilityRole="button"
              accessibilityState={{ disabled: nextDisabled }}
              disabled={nextDisabled}
              onPress={() => setDisplayMonth(nextMonth)}
              style={({ pressed }) => [
                styles.monthButton,
                pressed && styles.pressed,
                nextDisabled && styles.disabled,
              ]}>
              <Ionicons color={designTokens.color.primaryStrong} name="chevron-forward" size={22} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {weekdayLabels.map((weekday) => (
              <Text key={weekday} style={styles.weekday}>{weekday}</Text>
            ))}
          </View>

          <View style={styles.dayGrid}>
            {days.map((day, index) => {
              if (day === null) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }

              const isoDate = toIsoDate(year, month, day);
              const selected = isoDate === value;
              const disabled = (minimumValue !== undefined && isoDate < minimumValue)
                || (maximumValue !== undefined && isoDate > maximumValue);

              return (
                <View key={isoDate} style={styles.dayCell}>
                  <Pressable
                    accessibilityLabel={getDayAccessibilityLabel(year, month, day)}
                    accessibilityRole="button"
                    accessibilityState={{ disabled, selected }}
                    disabled={disabled}
                    onPress={() => {
                      setVisible(false);
                      onChange(isoDate);
                    }}
                    style={({ pressed }) => [
                      styles.dayButton,
                      selected && styles.dayButtonSelected,
                      pressed && styles.pressed,
                      disabled && styles.disabled,
                    ]}>
                    <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: 'center',
    backgroundColor: designTokens.color.surface.raised,
    borderColor: designTokens.color.border.subtle,
    borderRadius: designTokens.radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: designTokens.space[8],
    minHeight: designTokens.size.touchTargetMin,
    paddingHorizontal: designTokens.space[12],
  },
  triggerText: {
    color: designTokens.color.text.primary,
    flex: 1,
    fontSize: designTokens.typography.size.body,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.body,
  },
  placeholder: {
    color: designTokens.color.text.secondary,
    fontWeight: designTokens.typography.weight.regular,
  },
  calendar: {
    backgroundColor: designTokens.color.surface.raised,
    borderColor: designTokens.color.border.subtle,
    borderRadius: designTokens.radius.row,
    borderWidth: 1,
    marginTop: designTokens.space[8],
    padding: designTokens.space[12],
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthButton: {
    alignItems: 'center',
    borderRadius: designTokens.radius.pill,
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
    minWidth: designTokens.size.touchTargetMin,
  },
  monthTitle: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.body,
  },
  weekRow: {
    flexDirection: 'row',
    marginTop: designTokens.space[4],
  },
  weekday: {
    color: designTokens.color.text.secondary,
    flex: 1,
    fontSize: designTokens.typography.size.meta,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.meta,
    textAlign: 'center',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: designTokens.space[4],
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '14.285714%',
  },
  dayButton: {
    alignItems: 'center',
    borderRadius: designTokens.radius.pill,
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
    minWidth: designTokens.size.touchTargetMin,
  },
  dayButtonSelected: {
    backgroundColor: designTokens.color.primaryStrong,
  },
  dayText: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  dayTextSelected: {
    color: designTokens.color.text.inverse,
  },
  pressed: {
    opacity: designTokens.state.pressedOpacity,
  },
  disabled: {
    opacity: designTokens.state.disabledOpacity,
  },
});
