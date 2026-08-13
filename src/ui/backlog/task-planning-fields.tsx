import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { EntityId, ScheduleBlock } from '../../domain/entities';
import { designTokens } from '../design/tokens';
import { PlanningDatePicker } from './planning-date-picker';
import {
  PlanningValuePicker,
  type PlanningValueOption,
} from './planning-value-picker';

export type TaskScheduleMode = 'none' | 'date' | 'period';
export type TaskRepeatFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

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
  scheduledOn: string;
  scheduleMode: TaskScheduleMode;
}

export interface TaskPlanningFieldsProps {
  defaultBlock: TaskPlanningBlock;
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
];

function formatRussianCount(value: number, forms: readonly [string, string, string]): string {
  const tens = value % 100;
  const units = value % 10;
  if (tens >= 11 && tens <= 14) {
    return forms[2];
  }
  if (units === 1) {
    return forms[0];
  }
  if (units >= 2 && units <= 4) {
    return forms[1];
  }
  return forms[2];
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} ${formatRussianCount(minutes, ['минута', 'минуты', 'минут'])}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const hoursLabel = `${hours} ${formatRussianCount(hours, ['час', 'часа', 'часов'])}`;
  if (remainingMinutes === 0) {
    return hoursLabel;
  }
  return `${hoursLabel} ${remainingMinutes} ${formatRussianCount(remainingMinutes, ['минута', 'минуты', 'минут'])}`;
}

const timeOptions: readonly PlanningValueOption[] = Array.from({ length: 24 * 12 }, (_, index) => {
  const hours = Math.floor(index / 12);
  const minutes = (index % 12) * 5;
  const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { label: value, value };
});

const durationOptions: readonly PlanningValueOption[] = Array.from({ length: 96 }, (_, index) => {
  const minutes = (index + 1) * 5;
  return { label: formatDuration(minutes), value: String(minutes) };
});

export function createInitialTaskPlanningDraft(): TaskPlanningDraft {
  return {
    blocks: [],
    periodEndOn: '',
    periodStartOn: '',
    repeatFrequency: 'none',
    repeatInterval: '1',
    scheduledOn: '',
    scheduleMode: 'none',
  };
}

export function createDefaultBlock(defaultDate: string, now = new Date()): TaskPlanningBlock {
  const [year, month, day] = defaultDate.split('-').map(Number);
  const startsAt = new Date(
    year,
    month - 1,
    day,
    now.getHours(),
    Math.ceil(now.getMinutes() / 5) * 5,
    0,
    0,
  );
  if (startsAt.getTime() <= now.getTime()) {
    startsAt.setMinutes(startsAt.getMinutes() + 5);
  }

  const blockDate = `${startsAt.getFullYear()}-${String(startsAt.getMonth() + 1).padStart(2, '0')}-${String(startsAt.getDate()).padStart(2, '0')}`;

  return {
    date: blockDate,
    durationMinutes: '60',
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startsAt: `${String(startsAt.getHours()).padStart(2, '0')}:${String(startsAt.getMinutes()).padStart(2, '0')}`,
  };
}

export function validateTaskPlanningDraft(value: TaskPlanningDraft): string | null {
  if (value.scheduleMode === 'date' && !isValidLocalDate(value.scheduledOn)) {
    return 'Укажите корректную дату задачи';
  }

  if (value.scheduleMode === 'period') {
    if (!isValidLocalDate(value.periodStartOn) || !isValidLocalDate(value.periodEndOn)) {
      return 'Укажите корректные даты начала и конца периода';
    }
    if (value.periodStartOn > value.periodEndOn) {
      return 'Начало периода не может быть позже конца';
    }
  }

  if (value.repeatFrequency !== 'none' && (!Number.isInteger(Number(value.repeatInterval)) || Number(value.repeatInterval) <= 0)) {
    return 'Интервал повторения должен быть целым числом больше нуля';
  }

  const invalidBlockIndex = value.blocks.findIndex((block) => {
    const durationMinutes = Number(block.durationMinutes);
    return block.date.trim() === ''
      || block.startsAt.trim() === ''
      || !Number.isInteger(durationMinutes)
      || durationMinutes <= 0
      || durationMinutes > 480
      || durationMinutes % 5 !== 0
      || !isValidLocalDate(block.date)
      || !isValidBlockStart(block.startsAt);
  });

  return invalidBlockIndex === -1
    ? null
    : `Исправьте временной интервал ${invalidBlockIndex + 1}: дата, начало и длительность должны быть корректными`;
}

function isValidLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return false;
  }

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year)
    && date.getMonth() === Number(month) - 1
    && date.getDate() === Number(day);
}

function isValidBlockStart(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) {
    return false;
  }

  const [, hours, minutes] = match;
  return Number(hours) >= 0
    && Number(hours) <= 23
    && Number(minutes) >= 0
    && Number(minutes) <= 59
    && Number(minutes) % 5 === 0;
}

function toOffsetIsoDateTime(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const offsetHours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
  const offsetRemainder = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:00${sign}${offsetHours}:${offsetRemainder}`;
}

function getCurrentTimeZoneId(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export function createScheduleBlocksFromDraft(
  draft: TaskPlanningDraft,
  taskItemId: EntityId,
  createdAt: string,
): ScheduleBlock[] {
  const timeZoneId = getCurrentTimeZoneId();
  return draft.blocks.map((block) => {
    const [year, month, day] = block.date.split('-').map(Number);
    const [hours, minutes] = block.startsAt.split(':').map(Number);
    const startsAt = new Date(year, month - 1, day, hours, minutes);
    const endsAt = new Date(startsAt.getTime() + Number(block.durationMinutes) * 60_000);

    return {
      id: block.id,
      taskItemId,
      occurrenceId: null,
      startsAt: toOffsetIsoDateTime(startsAt),
      endsAt: toOffsetIsoDateTime(endsAt),
      timeZoneId,
      createdAt,
    };
  });
}

type OpenDatePicker = 'scheduled' | 'period-start' | 'period-end' | null;

export function TaskPlanningFields({ defaultBlock, onChange, value }: TaskPlanningFieldsProps) {
  const [openDatePicker, setOpenDatePicker] = useState<OpenDatePicker>(null);
  const validationMessage = useMemo(() => validateTaskPlanningDraft(value), [value]);
  const update = (patch: Partial<TaskPlanningDraft>) => onChange({ ...value, ...patch });

  const selectScheduleMode = (scheduleMode: TaskScheduleMode) => {
    if (scheduleMode === 'date') {
      update({
        scheduleMode,
        scheduledOn: value.scheduledOn || defaultBlock.date,
      });
      setOpenDatePicker('scheduled');
      return;
    }
    if (scheduleMode === 'period') {
      update({
        scheduleMode,
        periodStartOn: value.periodStartOn || defaultBlock.date,
        periodEndOn: value.periodEndOn || defaultBlock.date,
      });
      setOpenDatePicker('period-start');
      return;
    }

    update({ scheduleMode });
    setOpenDatePicker(null);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Планирование</Text>
      <Text style={styles.helper}>Выберите дату задачи и при необходимости добавьте точное время.</Text>

      <View style={styles.chips}>
        {scheduleModes.map((option) => {
          const selected = value.scheduleMode === option.value;
          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => selectScheduleMode(option.value)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {value.scheduleMode === 'date' ? (
        <Field label="Дата задачи">
          <PlanningDatePicker
            accessibilityLabel="Дата задачи"
            onChange={(scheduledOn) => update({ scheduledOn })}
            onVisibleChange={(visible) => setOpenDatePicker(visible ? 'scheduled' : null)}
            value={value.scheduledOn}
            visible={openDatePicker === 'scheduled'}
          />
        </Field>
      ) : null}

      {value.scheduleMode === 'period' ? (
        <View>
          <Field label="Начало периода">
            <PlanningDatePicker
              accessibilityLabel="Начало периода задачи"
              maximumValue={value.periodEndOn || undefined}
              onChange={(periodStartOn) => {
                update({ periodStartOn });
                setOpenDatePicker('period-end');
              }}
              onVisibleChange={(visible) => setOpenDatePicker(visible ? 'period-start' : null)}
              value={value.periodStartOn}
              visible={openDatePicker === 'period-start'}
            />
          </Field>
          <Field label="Конец периода">
            <PlanningDatePicker
              accessibilityLabel="Конец периода задачи"
              minimumValue={value.periodStartOn || undefined}
              onChange={(periodEndOn) => update({ periodEndOn })}
              onVisibleChange={(visible) => setOpenDatePicker(visible ? 'period-end' : null)}
              value={value.periodEndOn}
              visible={openDatePicker === 'period-end'}
            />
          </Field>
        </View>
      ) : null}

      <View style={styles.intervalHeading}>
        <View style={styles.intervalHeadingCopy}>
          <Text style={styles.label}>Точное время</Text>
          <Text style={styles.helper}>Интервалы попадут в расписание выбранного дня.</Text>
        </View>
        <Pressable
          accessibilityLabel="Добавить временной интервал"
          accessibilityRole="button"
          onPress={() => update({
            blocks: [
              ...value.blocks,
              { ...defaultBlock, id: `${defaultBlock.id}-${value.blocks.length + 1}` },
            ],
          })}
          style={({ pressed }) => [styles.addIntervalButton, pressed && styles.pressed]}>
          <Ionicons color={designTokens.color.primaryStrong} name="add-circle-outline" size={20} />
          <Text style={styles.addIntervalText}>Добавить</Text>
        </Pressable>
      </View>

      {value.blocks.map((block, index) => (
        <View key={block.id} style={styles.interval}>
          <View style={styles.intervalTitleRow}>
            <Text style={styles.intervalTitle}>Интервал {index + 1}</Text>
            <Pressable
              accessibilityLabel={`Удалить интервал ${index + 1}`}
              accessibilityRole="button"
              onPress={() => update({ blocks: value.blocks.filter((entry) => entry.id !== block.id) })}
              style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
              <Ionicons color={designTokens.color.feedback.danger.foreground} name="trash-outline" size={19} />
            </Pressable>
          </View>
          <Field label="Дата">
            <PlanningDatePicker
              accessibilityLabel={`Дата интервала ${index + 1}`}
              onChange={(date) => updateBlock(value, block.id, { date }, onChange)}
              value={block.date}
            />
          </Field>
          <View style={styles.intervalValues}>
            <View style={styles.intervalValue}>
              <Field label="Начало">
                <PlanningValuePicker
                  accessibilityLabel={`Начало интервала ${index + 1}`}
                  onChange={(startsAt) => updateBlock(value, block.id, { startsAt }, onChange)}
                  options={timeOptions}
                  title="Выберите время начала"
                  value={block.startsAt}
                />
              </Field>
            </View>
            <View style={styles.intervalValue}>
              <Field label="Длительность">
                <PlanningValuePicker
                  accessibilityLabel={`Длительность интервала ${index + 1}`}
                  onChange={(durationMinutes) => updateBlock(value, block.id, { durationMinutes }, onChange)}
                  options={durationOptions}
                  title="Выберите длительность"
                  value={block.durationMinutes}
                />
              </Field>
            </View>
          </View>
        </View>
      ))}

      <Text style={styles.label}>Повторение</Text>
      <View style={styles.chips}>
        {repeatOptions.map((option) => {
          const selected = value.repeatFrequency === option.value;
          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => update({ repeatFrequency: option.value })}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {value.repeatFrequency !== 'none' ? (
        <Field label="Интервал повторения">
          <TextInput
            accessibilityLabel="Интервал повторения"
            keyboardType="number-pad"
            onChangeText={(repeatInterval) => update({ repeatInterval })}
            placeholder="Например, 1"
            placeholderTextColor={designTokens.color.text.tertiary}
            style={styles.input}
            value={value.repeatInterval}
          />
        </Field>
      ) : null}

      {validationMessage !== null ? (
        <Text accessibilityRole="alert" style={styles.error}>{validationMessage}</Text>
      ) : null}
    </View>
  );
}

function updateBlock(
  value: TaskPlanningDraft,
  id: string,
  patch: Partial<TaskPlanningBlock>,
  onChange: (value: TaskPlanningDraft) => void,
) {
  onChange({
    ...value,
    blocks: value.blocks.map((block) => block.id === id ? { ...block, ...patch } : block),
  });
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {children}
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
  helper: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
    marginTop: designTokens.space[4],
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
    marginTop: designTokens.space[10],
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
  intervalHeading: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: designTokens.space[12],
    justifyContent: 'space-between',
    marginTop: designTokens.space[4],
  },
  intervalHeadingCopy: {
    flex: 1,
  },
  addIntervalButton: {
    alignItems: 'center',
    borderRadius: designTokens.radius.control,
    flexDirection: 'row',
    gap: designTokens.space[4],
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
    paddingHorizontal: designTokens.space[8],
  },
  addIntervalText: {
    color: designTokens.color.primaryStrong,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  interval: {
    backgroundColor: designTokens.color.surface.subtle,
    borderRadius: designTokens.radius.row,
    marginTop: designTokens.space[12],
    padding: designTokens.space[12],
  },
  intervalTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  intervalTitle: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  removeButton: {
    alignItems: 'center',
    borderRadius: designTokens.radius.pill,
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
    minWidth: designTokens.size.touchTargetMin,
  },
  intervalValues: {
    flexDirection: 'row',
    gap: designTokens.space[8],
  },
  intervalValue: {
    flex: 1,
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
  error: {
    color: designTokens.color.feedback.danger.foreground,
    fontSize: designTokens.typography.size.meta,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.meta,
    marginTop: designTokens.space[12],
  },
  pressed: {
    opacity: designTokens.state.pressedOpacity,
  },
});
