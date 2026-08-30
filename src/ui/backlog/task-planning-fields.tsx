import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { designTokens } from '../design/tokens';
import { formatDuration } from '../format-duration';
import { PlanningValuePicker, type PlanningValueOption } from './planning-value-picker';
import { PlanningDatePicker } from './planning-date-picker';
import { getDateInTimeZone, getTimeInTimeZone } from '../../domain/planning';

export type TaskScheduleMode = 'none' | 'date' | 'period';
export type TaskRepeatFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'intervalDays';

export interface TaskPlanningBlock {
  date: string;
  durationMinutes: string;
  id: string;
  startsAt: string;
}

export interface TaskPlanningDraft {
  blocks: TaskPlanningBlock[];
  periodEndOn: string;
  periodStartOn: string;
  repeatFrequency: TaskRepeatFrequency;
  repeatInterval: string;
  repeatWeekdays: number[];
  scheduledOn: string;
  scheduleMode: TaskScheduleMode;
}

export interface TaskPlanningFieldsProps {
  defaultBlock: TaskPlanningBlock | null;
  onChange: (value: TaskPlanningDraft) => void;
  value: TaskPlanningDraft;
}

const scheduleModes: { label: string; value: TaskScheduleMode }[] = [
  { label: 'Без даты', value: 'none' },
  { label: 'Дата', value: 'date' },
  { label: 'Период', value: 'period' },
];

const repeatOptions: { label: string; value: TaskRepeatFrequency }[] = [
  { label: 'Нет', value: 'none' },
  { label: 'Каждый день', value: 'daily' },
  { label: 'Каждую неделю', value: 'weekly' },
  { label: 'Каждый месяц', value: 'monthly' },
  { label: 'Каждый год', value: 'yearly' },
  { label: 'Каждые N дней', value: 'intervalDays' },
];
const timeOptions: readonly PlanningValueOption[] = Array.from({ length: 288 }, (_, index) => {
  const value = `${String(Math.floor(index / 12)).padStart(2, '0')}:${String((index % 12) * 5).padStart(2, '0')}`;
  return { label: value, value };
});
const durationOptions: readonly PlanningValueOption[] = Array.from({ length: 96 }, (_, index) => {
  const minutes = (index + 1) * 5;
  return { label: formatDuration(minutes), value: String(minutes) };
});

export function createInitialTaskPlanningDraft(defaultDate?: string): TaskPlanningDraft {
  return {
    blocks: [],
    periodEndOn: '',
    periodStartOn: '',
    repeatFrequency: 'none',
    repeatInterval: '1',
    repeatWeekdays: [],
    scheduledOn: defaultDate ?? '',
    scheduleMode: defaultDate === undefined ? 'none' : 'date',
  };
}

export function createDefaultBlock(defaultDate: string, now = new Date(), timeZoneId = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'): TaskPlanningBlock {
  const [hours, minutes] = getTimeInTimeZone(now.toISOString(), timeZoneId).split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const roundedMinutes = (Math.floor(totalMinutes / 5) + 1) * 5;
  const [year, month, day] = defaultDate.split('-').map(Number);
  const date = Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
    ? new Date(year, month - 1, day)
    : new Date(`${getDateInTimeZone(now.toISOString(), timeZoneId)}T00:00:00`);
  date.setDate(date.getDate() + Math.floor(roundedMinutes / (24 * 60)));
  const hour = Math.floor((roundedMinutes % (24 * 60)) / 60);
  const minute = roundedMinutes % 60;

  return {
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    durationMinutes: '60',
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startsAt: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

export function validateTaskPlanningDraft(value: TaskPlanningDraft): string | null {
  if (value.scheduleMode === 'date' && value.scheduledOn.trim() === '') {
    return 'Укажите дату задачи';
  }

  if (value.scheduleMode === 'period') {
    if (value.periodStartOn.trim() === '' || value.periodEndOn.trim() === '') {
      return 'Укажите начало и конец периода задачи';
    }
    if (value.periodStartOn > value.periodEndOn) {
      return 'Начало периода не может быть позже конца';
    }
  }

  if (value.repeatFrequency !== 'none' && (!Number.isInteger(Number(value.repeatInterval)) || Number(value.repeatInterval) <= 0)) {
    return 'Интервал повторения должен быть целым числом больше нуля';
  }

  const invalidBlockIndex = value.blocks.findIndex((block) => (
    block.date.trim() === ''
    || block.startsAt.trim() === ''
    || !Number.isInteger(Number(block.durationMinutes))
    || Number(block.durationMinutes) <= 0
  ));

  return invalidBlockIndex === -1 ? null : `Заполните корректно блок времени ${invalidBlockIndex + 1}`;
}

export function TaskPlanningFields({ defaultBlock, onChange, value }: TaskPlanningFieldsProps) {
  const update = (patch: Partial<TaskPlanningDraft>) => onChange({ ...value, ...patch });

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Планирование</Text>
      <View style={styles.chips}>
        {scheduleModes.map((option) => {
          const selected = value.scheduleMode === option.value;
          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="button"
              key={option.value}
              onPress={() => update({ scheduleMode: option.value })}
              style={[styles.chip, selected && styles.chipSelected]}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {value.scheduleMode === 'date' ? (
        <Field label="Дата задачи"><PlanningDatePicker accessibilityLabel="Дата задачи" onChange={(scheduledOn) => update({ scheduledOn })} value={value.scheduledOn} /></Field>
      ) : null}
      {value.scheduleMode === 'period' ? (
        <View>
          <Field label="Начало периода"><PlanningDatePicker accessibilityLabel="Начало периода задачи" onChange={(periodStartOn) => update({ periodStartOn, periodEndOn: value.periodEndOn < periodStartOn ? periodStartOn : value.periodEndOn })} value={value.periodStartOn} /></Field>
          <Field label="Конец периода"><PlanningDatePicker accessibilityLabel="Конец периода задачи" onChange={(periodEndOn) => update({ periodEndOn })} value={value.periodEndOn} /></Field>
        </View>
      ) : null}
      <Text style={styles.label}>Повторение</Text>
      <View style={styles.chips}>
        {repeatOptions.map((option) => {
          const selected = value.repeatFrequency === option.value;
          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="button"
              key={option.value}
              onPress={() => update({ repeatFrequency: option.value })}
              style={[styles.chip, selected && styles.chipSelected]}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {value.repeatFrequency !== 'none' ? (
        <PlanningInput accessibilityLabel="Интервал повторения" keyboardType="number-pad" label="Интервал" onChangeText={(repeatInterval) => update({ repeatInterval })} value={value.repeatInterval} />
      ) : null}
      {value.repeatFrequency === 'weekly' ? <View><Text style={styles.label}>Дни недели</Text><View style={styles.chips}>{[['Пн', 1], ['Вт', 2], ['Ср', 3], ['Чт', 4], ['Пт', 5], ['Сб', 6], ['Вс', 0]].map(([label, day]) => { const selected = value.repeatWeekdays.includes(day as number); return <Pressable accessibilityLabel={String(label)} key={String(label)} onPress={() => update({ repeatWeekdays: selected ? value.repeatWeekdays.filter((entry) => entry !== day) : [...value.repeatWeekdays, day as number] })} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>; })}</View></View> : null}
      <View style={styles.blockHeader}>
        <Text style={styles.label}>Временные блоки</Text>
        <Pressable
          accessibilityLabel="Добавить блок времени"
          accessibilityRole="button"
          accessibilityState={{ disabled: defaultBlock === null }}
          onPress={() => { if (defaultBlock !== null) update({ blocks: [...value.blocks, { ...defaultBlock, id: `${defaultBlock.id}-${value.blocks.length + 1}` }] }); }}
          style={[styles.addBlockButton, defaultBlock === null && styles.disabled]}>
          <Text style={[styles.addBlockText, defaultBlock === null && styles.disabledText]}>{defaultBlock === null ? 'Нет свободного блока' : 'Добавить блок времени'}</Text>
        </Pressable>
      </View>
      {value.blocks.map((block, index) => (
        <View key={block.id} style={styles.block}>
          <View style={styles.blockTitleRow}>
            <Text style={styles.blockTitle}>Блок {index + 1}</Text>
            <Pressable accessibilityLabel={`Удалить блок ${index + 1}`} onPress={() => update({ blocks: value.blocks.filter((entry) => entry.id !== block.id) })}>
              <Text style={styles.removeBlockText}>Удалить</Text>
            </Pressable>
          </View>
          <Field label="Дата"><PlanningDatePicker accessibilityLabel={`Дата блока ${index + 1}`} onChange={(date) => updateBlock(value, block.id, { date }, onChange)} value={block.date} /></Field>
          <Text style={styles.label}>Начало</Text>
          <PlanningValuePicker accessibilityLabel={`Начало блока ${index + 1}`} onChange={(startsAt) => updateBlock(value, block.id, { startsAt }, onChange)} options={timeOptions} title="Начало блока" value={block.startsAt} />
          <Text style={styles.label}>Длительность</Text>
          <PlanningValuePicker accessibilityLabel={`Длительность блока ${index + 1}`} onChange={(durationMinutes) => updateBlock(value, block.id, { durationMinutes }, onChange)} options={durationOptions} title="Длительность блока" value={block.durationMinutes} />
        </View>
      ))}
    </View>
  );
}

function updateBlock(value: TaskPlanningDraft, id: string, patch: Partial<TaskPlanningBlock>, onChange: (value: TaskPlanningDraft) => void) {
  onChange({
    ...value,
    blocks: value.blocks.map((block) => block.id === id ? { ...block, ...patch } : block),
  });
}

function Field({ label, children }: { label: string; children: import('react').ReactNode }) {
  return <View><Text style={styles.label}>{label}</Text>{children}</View>;
}

function PlanningInput({
  accessibilityLabel,
  keyboardType,
  label,
  onChangeText,
  value,
}: {
  accessibilityLabel: string;
  keyboardType?: 'default' | 'number-pad';
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={keyboardType === 'number-pad' ? 'Например, 60' : 'ГГГГ-ММ-ДД'}
        placeholderTextColor={designTokens.color.text.tertiary}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: designTokens.space[20],
  },
  sectionTitle: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.sectionTitle,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.sectionTitle,
  },
  label: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.label,
    marginBottom: designTokens.space[6],
    marginTop: designTokens.space[16],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: designTokens.space[8],
  },
  chip: {
    borderColor: designTokens.color.border.subtle,
    borderRadius: designTokens.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
    paddingHorizontal: designTokens.space[12],
  },
  chipSelected: {
    backgroundColor: designTokens.color.primarySoft,
    borderColor: designTokens.color.primary,
  },
  chipText: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  chipTextSelected: {
    color: designTokens.color.primaryStrong,
  },
  input: {
    backgroundColor: designTokens.color.surface.raised,
    borderColor: designTokens.color.border.subtle,
    borderRadius: designTokens.radius.control,
    borderWidth: 1,
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
    minHeight: designTokens.size.touchTargetMin,
    paddingHorizontal: designTokens.space[12],
  },
  blockHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  addBlockButton: {
    minHeight: designTokens.size.touchTargetMin,
    justifyContent: 'center',
  },
  addBlockText: {
    color: designTokens.color.primaryStrong,
    fontSize: designTokens.typography.size.meta,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  disabled: { opacity: designTokens.state.disabledOpacity },
  disabledText: { color: designTokens.color.text.tertiary },
  block: {
    backgroundColor: designTokens.color.surface.subtle,
    borderRadius: designTokens.radius.row,
    marginTop: designTokens.space[8],
    padding: designTokens.space[12],
  },
  blockTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  blockTitle: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  removeBlockText: {
    color: designTokens.color.feedback.danger.foreground,
    fontSize: designTokens.typography.size.meta,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
});
