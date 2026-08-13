import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { EntityId, ScheduleBlock } from '../../domain/entities';
import { designTokens } from '../design/tokens';

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
    || Number(block.durationMinutes) % 5 !== 0
    || !isValidLocalDate(block.date)
    || !isValidBlockStart(block.startsAt)
  ));

  return invalidBlockIndex === -1 ? null : `Заполните корректно блок времени ${invalidBlockIndex + 1}`;
}

function isValidLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return false;
  }

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return (
    date.getFullYear() === Number(year)
    && date.getMonth() === Number(month) - 1
    && date.getDate() === Number(day)
  );
}

function isValidBlockStart(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) {
    return false;
  }

  const [, hours, minutes] = match;
  return (
    Number(hours) >= 0
    && Number(hours) <= 23
    && Number(minutes) >= 0
    && Number(minutes) <= 59
    && Number(minutes) % 5 === 0
  );
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

export function createScheduleBlocksFromDraft(
  draft: TaskPlanningDraft,
  taskItemId: EntityId,
  createdAt: string,
): ScheduleBlock[] {
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
      timeZoneId: null,
      createdAt,
    };
  });
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
        <PlanningInput accessibilityLabel="Дата задачи" label="Дата задачи" onChangeText={(scheduledOn) => {
          update({ scheduledOn });
        }} value={value.scheduledOn} />
      ) : null}
      {value.scheduleMode === 'period' ? (
        <View>
          <PlanningInput accessibilityLabel="Начало периода задачи" label="Начало периода" onChangeText={(periodStartOn) => update({ periodStartOn })} value={value.periodStartOn} />
          <PlanningInput accessibilityLabel="Конец периода задачи" label="Конец периода" onChangeText={(periodEndOn) => update({ periodEndOn })} value={value.periodEndOn} />
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
      <View style={styles.blockHeader}>
        <Text style={styles.label}>Временные блоки</Text>
        <Pressable
          accessibilityLabel="Добавить блок времени"
          accessibilityRole="button"
          onPress={() => update({ blocks: [...value.blocks, { ...defaultBlock, id: `${defaultBlock.id}-${value.blocks.length + 1}` }] })}
          style={styles.addBlockButton}>
          <Text style={styles.addBlockText}>Добавить блок времени</Text>
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
          <PlanningInput accessibilityLabel={`Дата блока ${index + 1}`} label="Дата" onChangeText={(date) => updateBlock(value, block.id, { date }, onChange)} value={block.date} />
          <PlanningInput accessibilityLabel={`Начало блока ${index + 1}`} label="Начало" onChangeText={(startsAt) => updateBlock(value, block.id, { startsAt }, onChange)} value={block.startsAt} />
          <PlanningInput accessibilityLabel={`Длительность блока ${index + 1}`} keyboardType="number-pad" label="Длительность, мин." onChangeText={(durationMinutes) => updateBlock(value, block.id, { durationMinutes }, onChange)} value={block.durationMinutes} />
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
