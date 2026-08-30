import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useOptionalAppServices } from '../../application/app-services-provider';
import { getDefaultSettings } from '../../data/default-settings';
import { getDateInTimeZone } from '../../domain/planning';
import { designTokens } from '../design/tokens';

const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function asDate(value: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return null;
  const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return date.getFullYear() === Number(parts[1]) && date.getMonth() === Number(parts[2]) - 1 ? date : null;
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function label(value: string): string {
  const date = asDate(value);
  return date === null ? 'Выбрать дату' : `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

interface PlanningDatePickerProps {
  accessibilityLabel: string;
  onChange: (value: string) => void;
  todayDate?: string;
  value: string;
}

export function PlanningDatePicker({ accessibilityLabel, onChange, todayDate, value }: PlanningDatePickerProps) {
  const services = useOptionalAppServices();
  const effectiveToday = todayDate ?? getDateInTimeZone(
    new Date().toISOString(),
    services?.settings.timeZoneId ?? getDefaultSettings().timeZoneId,
  );
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const date = asDate(value) ?? asDate(effectiveToday) ?? new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const cells = useMemo(() => {
    const lead = (month.getDay() + 6) % 7;
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: total }, (_, index) => index + 1)];
  }, [month]);

  return (
    <View>
      <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={() => setOpen(!open)} style={styles.trigger}>
        <Text style={styles.triggerText}>{label(value)}</Text><Text>⌄</Text>
      </Pressable>
      {open ? <View style={styles.calendar}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Предыдущий месяц" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.nav}><Text>‹</Text></Pressable>
          <Text style={styles.title}>{months[month.getMonth()]} {month.getFullYear()}</Text>
          <Pressable accessibilityLabel="Следующий месяц" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.nav}><Text>›</Text></Pressable>
        </View>
        <View style={styles.grid}>
          {cells.map((day, index) => {
            if (day === null) return <View key={`empty-${index}`} style={styles.cell} />;
            const isoDate = iso(month.getFullYear(), month.getMonth(), day);
            const isToday = isoDate === effectiveToday;
            return <Pressable accessibilityLabel={`${day} ${months[month.getMonth()]} ${month.getFullYear()}${isToday ? ', сегодня' : ''}`} key={day} onPress={() => { onChange(isoDate); setOpen(false); }} style={[styles.cell, isToday && styles.today, value === isoDate && styles.selected]}><Text>{day}</Text></Pressable>;
          })}
        </View>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { alignItems: 'center', backgroundColor: designTokens.color.surface.raised, borderColor: designTokens.color.border.subtle, borderRadius: designTokens.radius.control, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: designTokens.size.touchTargetMin, paddingHorizontal: designTokens.space[12] },
  triggerText: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.body },
  calendar: { backgroundColor: designTokens.color.surface.raised, borderColor: designTokens.color.border.subtle, borderRadius: designTokens.radius.row, borderWidth: 1, marginTop: designTokens.space[8], padding: designTokens.space[8] },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  nav: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  title: { color: designTokens.color.text.primary, fontWeight: designTokens.typography.weight.bold },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { alignItems: 'center', justifyContent: 'center', minHeight: 40, width: '14.2857%' },
  selected: { backgroundColor: designTokens.color.primarySoft, borderRadius: designTokens.radius.pill },
  today: { borderColor: designTokens.color.primaryStrong, borderRadius: designTokens.radius.pill, borderWidth: 2 },
});
