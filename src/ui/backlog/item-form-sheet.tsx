import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppServices } from '../../application/app-services-provider';
import type { SaveTaskPlanningInput } from '../../application/planning-types';
import type { Project, Reminder, TaskItem } from '../../domain/entities';
import { designTokens } from '../design/tokens';
import {
  createDefaultBlock,
  createInitialTaskPlanningDraft,
  TaskPlanningFields,
  type TaskPlanningDraft,
  validateTaskPlanningDraft,
} from './task-planning-fields';
import { PlanningValuePicker } from './planning-value-picker';
import { PlanningDatePicker } from './planning-date-picker';

export type ItemFormType = 'project' | 'task' | 'subtask' | 'reminder';
export type ItemFormMode = 'create' | 'edit';
type FormItem = Project | TaskItem | Reminder;
const estimateOptions = [
  { label: 'Без оценки', value: '' },
  ...Array.from({ length: 96 }, (_, index) => ({ label: `${(index + 1) * 5} мин`, value: String((index + 1) * 5) })),
];

interface ItemFormSheetProps {
  visible: boolean;
  mode: ItemFormMode;
  type: ItemFormType;
  onClose: () => void;
  item?: FormItem;
  parentTaskId?: string;
  projectId?: string | null;
  onSaved?: () => void;
  planningContext?: {
    defaultDate: string;
    onPlanningDraftChange?: (draft: TaskPlanningDraft) => void;
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function createItemId(type: ItemFormType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getInitialProjectId(item: FormItem | undefined, projectId: string | null | undefined): string | null {
  if (item !== undefined && 'projectId' in item) {
    return item.projectId;
  }

  return projectId ?? null;
}

function getInitialDescription(item: FormItem | undefined): string {
  return item !== undefined && 'description' in item ? item.description ?? '' : '';
}

function getInitialDuration(item: FormItem | undefined): string {
  return item !== undefined && 'estimatedDurationMinutes' in item && item.estimatedDurationMinutes !== null
    ? String(item.estimatedDurationMinutes)
    : '';
}

function getInitialReminderValue(item: FormItem | undefined, key: 'remindsOn' | 'periodStartOn' | 'periodEndOn'): string {
  if (item !== undefined && 'remindsOn' in item) {
    return item[key] ?? '';
  }

  return '';
}

function getInitialRepeatFrequency(item: FormItem | undefined): '' | 'daily' | 'weekly' | 'monthly' {
  if (item !== undefined && 'repeatRule' in item && item.repeatRule !== null) {
    return item.repeatRule.frequency;
  }

  return '';
}

function getInitialRepeatInterval(item: FormItem | undefined): string {
  return item !== undefined && 'repeatRule' in item && item.repeatRule !== null
    ? String(item.repeatRule.interval)
    : '1';
}

export function ItemFormSheet({
  visible,
  mode,
  type,
  onClose,
  item,
  parentTaskId,
  projectId,
  onSaved,
  planningContext,
}: ItemFormSheetProps) {
  const { backlog, backlogActions, planningActions } = useAppServices();
  const [title, setTitle] = useState(() => item?.title ?? '');
  const [description, setDescription] = useState(() => getInitialDescription(item));
  const [duration, setDuration] = useState(() => getInitialDuration(item));
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => getInitialProjectId(item, projectId));
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);
  const [remindsOn, setRemindsOn] = useState(() => getInitialReminderValue(item, 'remindsOn'));
  const [periodStartOn, setPeriodStartOn] = useState(() => getInitialReminderValue(item, 'periodStartOn'));
  const [periodEndOn, setPeriodEndOn] = useState(() => getInitialReminderValue(item, 'periodEndOn'));
  const [repeatFrequency, setRepeatFrequency] = useState<'' | 'daily' | 'weekly' | 'monthly'>(() => getInitialRepeatFrequency(item));
  const [repeatInterval, setRepeatInterval] = useState(() => getInitialRepeatInterval(item));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [planningDraft, setPlanningDraft] = useState<TaskPlanningDraft>(createInitialTaskPlanningDraft);
  const [persistedBlockIds, setPersistedBlockIds] = useState<readonly string[]>([]);
  const [pendingConflict, setPendingConflict] = useState<SaveTaskPlanningInput | null>(null);
  const defaultBlock = useMemo(
    () => createDefaultBlock(planningContext?.defaultDate ?? '', new Date()),
    [planningContext?.defaultDate],
  );
  const isPlanTaskForm = (type === 'task' || type === 'subtask') && planningContext !== undefined;
  useEffect(() => {
    if (!visible || !isPlanTaskForm || item === undefined || !('kind' in item)) return;
    void planningActions.getTaskPlanningSnapshot(item.id).then(({ blocks, recurrence }) => {
      setPersistedBlockIds(blocks.map((block) => block.id));
      setPlanningDraft({
        ...createInitialTaskPlanningDraft(),
        blocks: blocks.map((block) => ({ id: block.id, date: block.startsAt.slice(0, 10), startsAt: block.startsAt.slice(11, 16), durationMinutes: String((new Date(block.endsAt).getTime() - new Date(block.startsAt).getTime()) / 60_000) })),
        repeatFrequency: recurrence?.frequency ?? 'none',
        repeatInterval: String(recurrence?.interval ?? 1),
        scheduledOn: recurrence?.startsOn ?? '',
      });
    });
  }, [isPlanTaskForm, item, planningActions, visible]);

  const formTitle = useMemo(() => {
    const createTitle: Record<ItemFormType, string> = {
      project: 'Новый проект',
      task: 'Новая задача',
      subtask: 'Новая подзадача',
      reminder: 'Новое напоминание',
    };

    return mode === 'create' ? createTitle[type] : 'Редактировать';
  }, [mode, type]);

  const submit = async () => {
    setError(null);
    setIsSaving(true);

    try {
      if (isPlanTaskForm) {
        const planningError = validateTaskPlanningDraft(planningDraft);
        if (planningError !== null) {
          throw new Error(planningError);
        }
      }
      const estimatedDurationMinutes = duration.trim() === '' ? null : Number(duration);
      const now = new Date().toISOString();
      const persistPlanning = async (taskId: string) => {
        if (!isPlanTaskForm) return;
        const timeZoneId = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
        const blocks = planningDraft.blocks.map((block) => {
          const startsAt = new Date(`${block.date}T${block.startsAt}:00`);
          return {
            id: block.id,
            taskItemId: taskId,
            occurrenceId: null,
            timeZoneId,
            startsAt: startsAt.toISOString(),
            endsAt: new Date(startsAt.getTime() + Number(block.durationMinutes) * 60_000).toISOString(),
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          };
        });
        const recurrence = planningDraft.repeatFrequency === 'none' ? null : {
          id: `series-${taskId}`,
          frequency: planningDraft.repeatFrequency,
          interval: Number(planningDraft.repeatInterval),
          startsOn: planningDraft.blocks[0]?.date ?? planningDraft.scheduledOn ?? planningContext?.defaultDate ?? '',
          createdAt: now,
        };
        const input = { taskId, blocks, deletedBlockIds: persistedBlockIds.filter((id) => !blocks.some((block) => block.id === id)), recurrence };
        const result = await planningActions.saveTaskPlanning(input);
        if (result.conflict !== null) { setPendingConflict(input); throw new Error('Выбранное время пересекается с другим блоком. Сохранить с пересечением?'); }
      };

      if (type === 'project') {
        if (mode === 'create') {
          await backlogActions.createProject({
            id: createItemId(type),
            title,
            description,
            createdAt: now,
          });
        } else if (item !== undefined) {
          await backlogActions.updateProject({ id: item.id, title, description });
        }
      }

      if (type === 'task') {
        if (mode === 'create') {
          const taskId = createItemId(type);
          await backlogActions.createTask({
            id: taskId,
            title,
            description,
            projectId: selectedProjectId,
            estimatedDurationMinutes,
            createdAt: now,
          });
          await persistPlanning(taskId);
        } else if (item !== undefined && 'kind' in item && item.kind === 'task') {
          await backlogActions.updateTaskItem({
            id: item.id,
            title,
            description,
            estimatedDurationMinutes,
          });
          if (item.projectId !== selectedProjectId) {
            await backlogActions.moveTaskToProject({
              taskId: item.id,
              projectId: selectedProjectId,
            });
          }
          await persistPlanning(item.id);
        }
      }

      if (type === 'subtask') {
        if (mode === 'create') {
          if (parentTaskId === undefined) {
            throw new Error('Не выбрана задача-родитель');
          }
          const subtaskId = createItemId(type);
          await backlogActions.createSubtask({
            id: subtaskId,
            title,
            description,
            parentTaskId,
            estimatedDurationMinutes,
            createdAt: now,
          });
          await persistPlanning(subtaskId);
        } else if (item !== undefined && 'kind' in item && item.kind === 'subtask') {
          await backlogActions.updateTaskItem({
            id: item.id,
            title,
            description,
            estimatedDurationMinutes,
          });
          await persistPlanning(item.id);
        }
      }

      if (type === 'reminder') {
        const repeatRule = repeatFrequency === ''
          ? null
          : { frequency: repeatFrequency, interval: Number(repeatInterval) };
        const reminderInput = {
          title,
          remindsOn: emptyToNull(remindsOn),
          periodStartOn: emptyToNull(periodStartOn),
          periodEndOn: emptyToNull(periodEndOn),
          repeatRule,
          estimatedDurationMinutes,
        };

        if (mode === 'create') {
          const reminderId = createItemId(type);
          await backlogActions.createReminder({
            id: reminderId,
            ...reminderInput,
            createdAt: now,
          });
          await planningActions.syncReminderRecurrence(reminderId);
        } else if (item !== undefined) {
          await backlogActions.updateReminder({ id: item.id, ...reminderInput });
          await planningActions.syncReminderRecurrence(item.id);
        }
      }

      onSaved?.();
      onClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось сохранить изменения');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedProject = backlog.projects.find(
    (entry) => entry.project.id === selectedProjectId,
  )?.project;

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.heading}>{formTitle}</Text>
            <Pressable accessibilityLabel="Закрыть форму" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Название</Text>
            <TextInput
              accessibilityLabel="Название"
              autoFocus
              onChangeText={setTitle}
              placeholder="Например, подготовить документы"
              placeholderTextColor={designTokens.color.text.tertiary}
              style={styles.input}
              value={title}
            />
            <Text style={styles.label}>Описание</Text>
            <TextInput
              accessibilityLabel="Описание"
              multiline
              onChangeText={setDescription}
              placeholder="Необязательно"
              placeholderTextColor={designTokens.color.text.tertiary}
              style={[styles.input, styles.multilineInput]}
              value={description}
            />
            {type === 'task' ? (
              <View>
                <Text style={styles.label}>Проект</Text>
                <Pressable
                  accessibilityLabel="Выбрать проект"
                  onPress={() => setProjectPickerVisible((current) => !current)}
                  style={styles.selector}>
                  <Text style={styles.selectorText}>{selectedProject?.title ?? 'Без проекта'}</Text>
                  <Text style={styles.selectorChevron}>⌄</Text>
                </Pressable>
                {projectPickerVisible ? (
                  <View style={styles.projectOptions}>
                    <Pressable onPress={() => { setSelectedProjectId(null); setProjectPickerVisible(false); }} style={styles.option}>
                      <Text style={styles.optionText}>Без проекта</Text>
                    </Pressable>
                    {backlog.projects.map(({ project }) => (
                      <Pressable
                        key={project.id}
                        onPress={() => { setSelectedProjectId(project.id); setProjectPickerVisible(false); }}
                        style={styles.option}>
                        <Text style={styles.optionText}>{project.title}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
            {type === 'task' || type === 'subtask' || type === 'reminder' ? (
              <View>
                <Text style={styles.label}>Оценочная длительность, мин.</Text>
                <PlanningValuePicker accessibilityLabel="Оценочная длительность, мин." onChange={setDuration} options={estimateOptions} title="Оценочная длительность" value={duration} />
              </View>
            ) : null}
            {isPlanTaskForm ? (
              <TaskPlanningFields
                defaultBlock={defaultBlock}
                onChange={(draft) => {
                  setPlanningDraft(draft);
                  planningContext.onPlanningDraftChange?.(draft);
                }}
                value={planningDraft}
              />
            ) : null}
            {type === 'reminder' ? (
              <View style={styles.reminderFields}>
                <Text style={styles.label}>Дата</Text>
                <PlanningDatePicker accessibilityLabel="Дата" onChange={setRemindsOn} value={remindsOn} />
                <Text style={styles.label}>Начало периода</Text>
                <PlanningDatePicker accessibilityLabel="Начало периода" onChange={setPeriodStartOn} value={periodStartOn} />
                <Text style={styles.label}>Конец периода</Text>
                <PlanningDatePicker accessibilityLabel="Конец периода" onChange={setPeriodEndOn} value={periodEndOn} />
                <Text style={styles.label}>Повторение</Text>
                <View style={styles.repeatOptions}>
                  {([
                    ['Нет', ''],
                    ['Каждый день', 'daily'],
                    ['Каждую неделю', 'weekly'],
                    ['Каждый месяц', 'monthly'],
                  ] as const).map(([label, value]) => (
                    <Pressable
                      key={label}
                      onPress={() => setRepeatFrequency(value)}
                      style={[styles.repeatOption, repeatFrequency === value && styles.repeatOptionSelected]}>
                      <Text style={[styles.repeatOptionText, repeatFrequency === value && styles.repeatOptionTextSelected]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                {repeatFrequency !== '' ? (
                  <TextInput accessibilityLabel="Интервал повторения" keyboardType="number-pad" onChangeText={setRepeatInterval} placeholder="Интервал" placeholderTextColor={designTokens.color.text.tertiary} style={styles.input} value={repeatInterval} />
                ) : null}
              </View>
            ) : null}
            {error === null ? null : <Text style={styles.error}>{error}</Text>}
            {pendingConflict === null ? null : <Pressable accessibilityLabel="Сохранить с пересечением" onPress={() => void planningActions.saveTaskPlanning({ ...pendingConflict, forceConflicts: true }).then(() => { setPendingConflict(null); onClose(); })} style={styles.conflictAction}><Text style={styles.primaryActionText}>Сохранить с пересечением</Text></Pressable>}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={[styles.action, styles.secondaryAction]}>
              <Text style={styles.secondaryActionText}>Отмена</Text>
            </Pressable>
            <Pressable accessibilityState={{ disabled: isSaving }} onPress={() => void submit()} style={[styles.action, styles.primaryAction, isSaving && styles.disabledAction]}>
              <Text style={styles.primaryActionText}>{isSaving ? 'Сохранение…' : isPlanTaskForm ? 'Создать' : 'Сохранить'}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: designTokens.color.overlay.scrim },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: designTokens.radius.sheet,
    borderTopRightRadius: designTokens.radius.sheet,
    backgroundColor: designTokens.color.surface.base,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: designTokens.radius.pill,
    marginTop: designTokens.space[10],
    backgroundColor: designTokens.color.text.tertiary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: designTokens.space[20],
    paddingTop: designTokens.space[16],
    paddingBottom: designTokens.space[12],
  },
  heading: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.sectionTitle,
    lineHeight: designTokens.typography.lineHeight.sectionTitle,
    fontWeight: designTokens.typography.weight.bold,
  },
  closeButton: {
    width: designTokens.size.touchTargetMin,
    height: designTokens.size.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.sectionTitle },
  content: { paddingHorizontal: designTokens.space[20], paddingBottom: designTokens.space[20] },
  label: {
    marginTop: designTokens.space[16],
    marginBottom: designTokens.space[6],
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
    fontWeight: designTokens.typography.weight.semibold,
  },
  input: {
    minHeight: designTokens.size.touchTargetMin,
    borderWidth: 1,
    borderColor: designTokens.color.border.subtle,
    borderRadius: designTokens.radius.control,
    backgroundColor: designTokens.color.surface.raised,
    paddingHorizontal: designTokens.space[12],
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
  multilineInput: { minHeight: 88, paddingTop: designTokens.space[12], textAlignVertical: 'top' },
  selector: {
    minHeight: designTokens.size.touchTargetMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: designTokens.color.border.subtle,
    borderRadius: designTokens.radius.control,
    backgroundColor: designTokens.color.surface.raised,
    paddingHorizontal: designTokens.space[12],
  },
  selectorText: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
  selectorChevron: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.sectionTitle },
  projectOptions: {
    overflow: 'hidden',
    marginTop: designTokens.space[4],
    borderRadius: designTokens.radius.control,
    backgroundColor: designTokens.color.surface.raised,
  },
  option: { minHeight: designTokens.size.touchTargetMin, justifyContent: 'center', paddingHorizontal: designTokens.space[12] },
  optionText: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
  reminderFields: { marginTop: designTokens.space[2] },
  repeatOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: designTokens.space[8] },
  repeatOption: {
    borderWidth: 1,
    borderColor: designTokens.color.border.subtle,
    borderRadius: designTokens.radius.pill,
    paddingHorizontal: designTokens.space[10],
    paddingVertical: designTokens.space[6],
    backgroundColor: designTokens.color.surface.raised,
  },
  repeatOptionSelected: { borderColor: designTokens.color.primary, backgroundColor: designTokens.color.primarySoft },
  repeatOptionText: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  repeatOptionTextSelected: { color: designTokens.color.primaryStrong, fontWeight: designTokens.typography.weight.bold },
  error: {
    marginTop: designTokens.space[16],
    color: designTokens.color.feedback.danger.foreground,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
    fontWeight: designTokens.typography.weight.semibold,
  },
  conflictAction: { alignItems: 'center', backgroundColor: designTokens.color.primary, borderRadius: designTokens.radius.control, justifyContent: 'center', marginTop: designTokens.space[12], minHeight: designTokens.size.touchTargetMin },
  footer: {
    flexDirection: 'row',
    gap: designTokens.space[10],
    borderTopWidth: 1,
    borderTopColor: designTokens.color.border.subtle,
    paddingHorizontal: designTokens.space[20],
    paddingVertical: designTokens.space[12],
    backgroundColor: designTokens.color.surface.raised,
  },
  action: {
    minHeight: designTokens.size.touchTargetMin,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designTokens.radius.control,
  },
  primaryAction: { backgroundColor: designTokens.color.primary },
  secondaryAction: { backgroundColor: designTokens.color.surface.subtle },
  primaryActionText: {
    color: designTokens.color.text.inverse,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
    fontWeight: designTokens.typography.weight.bold,
  },
  secondaryActionText: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
    fontWeight: designTokens.typography.weight.bold,
  },
  disabledAction: { opacity: designTokens.state.disabledOpacity },
});
