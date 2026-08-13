import { useMemo, useState } from 'react';
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
import type { Project, Reminder, ScheduleBlock, TaskItem } from '../../domain/entities';
import { designTokens } from '../design/tokens';
import {
  createScheduleBlocksFromDraft,
  createDefaultBlock,
  createInitialTaskPlanningDraft,
  TaskPlanningFields,
  type TaskPlanningDraft,
  validateTaskPlanningDraft,
} from './task-planning-fields';
import {
  ReminderTimeConfirmation,
  ScheduleConflictConfirmation,
} from './confirmation';

export type ItemFormType = 'project' | 'task' | 'subtask' | 'reminder';
export type ItemFormMode = 'create' | 'edit';
type FormItem = Project | TaskItem | Reminder;

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
    occurrence?: {
      id: string;
      occursOn: string;
      seriesId: string;
    };
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function createItemId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

interface PendingScheduleConflict {
  blocks: readonly ScheduleBlock[];
  titles: readonly string[];
}

interface PendingReminderConversion {
  block: ScheduleBlock;
  createdAt: string;
  projectId: string | null;
  reminderId: string;
  taskId: string;
}

function getRecurrenceStartOn(
  draft: TaskPlanningDraft,
  fallbackDate: string,
): string {
  if (draft.scheduleMode === 'date') {
    return draft.scheduledOn;
  }

  if (draft.scheduleMode === 'period') {
    return draft.periodStartOn;
  }

  return draft.blocks[0]?.date ?? fallbackDate;
}

function getScheduleConflictTitles(blocks: readonly ScheduleBlock[]): readonly string[] {
  return blocks.map((block) => `Блок ${block.startsAt.slice(11, 16)}–${block.endsAt.slice(11, 16)}`);
}

function getReminderTimeDraft(
  date: string,
  startsAt: string,
  durationMinutes: string,
): TaskPlanningDraft {
  return {
    ...createInitialTaskPlanningDraft(),
    blocks: [{
      date,
      durationMinutes,
      id: 'reminder-time-block',
      startsAt,
    }],
  };
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
  const [planningTaskId, setPlanningTaskId] = useState<string | null>(null);
  const [pendingScheduleConflict, setPendingScheduleConflict] = useState<PendingScheduleConflict | null>(null);
  const [occurrenceScope, setOccurrenceScope] = useState<'instance' | 'series' | null>(null);
  const [isReminderTimeEnabled, setIsReminderTimeEnabled] = useState(false);
  const [reminderBlockDate, setReminderBlockDate] = useState('');
  const [reminderBlockStartsAt, setReminderBlockStartsAt] = useState('');
  const [pendingReminderConversion, setPendingReminderConversion] = useState<PendingReminderConversion | null>(null);
  const defaultBlock = useMemo(
    () => createDefaultBlock(planningContext?.defaultDate ?? '', new Date()),
    [planningContext?.defaultDate],
  );
  const isPlanTaskForm = type === 'task' && planningContext !== undefined;
  const occurrence = planningContext?.occurrence;
  const canSelectProject = type === 'task' || (type === 'reminder' && isReminderTimeEnabled);

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
      if (type === 'reminder' && isReminderTimeEnabled) {
        const planningError = validateTaskPlanningDraft(
          getReminderTimeDraft(
            reminderBlockDate,
            reminderBlockStartsAt,
            duration,
          ),
        );
        if (planningError !== null) {
          throw new Error(planningError);
        }
      }
      const estimatedDurationMinutes = duration.trim() === '' ? null : Number(duration);
      const now = new Date().toISOString();

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
        let taskId: string | null = null;

        if (mode === 'create' && planningTaskId === null) {
          const createdTask = await backlogActions.createTask({
            id: createItemId(type),
            title,
            description,
            projectId: selectedProjectId,
            estimatedDurationMinutes,
            createdAt: now,
          });
          taskId = createdTask.id;
          if (isPlanTaskForm) {
            setPlanningTaskId(createdTask.id);
          }
        } else if (mode === 'create' && planningTaskId !== null) {
          taskId = planningTaskId;
          await backlogActions.updateTaskItem({
            id: taskId,
            title,
            description,
            estimatedDurationMinutes,
          });
          await backlogActions.moveTaskToProject({
            taskId,
            projectId: selectedProjectId,
          });
        } else if (item !== undefined && 'kind' in item && item.kind === 'task') {
          taskId = item.id;
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
        }

        if (isPlanTaskForm && taskId !== null) {
          if (occurrence !== undefined && occurrenceScope === null) {
            throw new Error('Выберите область изменения повторения');
          }

          if (occurrence !== undefined && occurrenceScope === 'instance') {
            await planningActions.saveOccurrenceException({
              id: occurrence.id,
              seriesId: occurrence.seriesId,
              occursOn: occurrence.occursOn,
              status: 'active',
              createdAt: now,
            });
            onSaved?.();
            onClose();
            return;
          }

          const recurrence = occurrenceScope === 'series' && planningDraft.repeatFrequency === 'none'
            ? undefined
            : planningDraft.repeatFrequency === 'none'
              ? null
              : {
                  id: occurrence?.seriesId ?? createItemId('recurrence'),
                  frequency: planningDraft.repeatFrequency,
                  interval: Number(planningDraft.repeatInterval),
                  startsOn: getRecurrenceStartOn(
                    planningDraft,
                    planningContext.defaultDate,
                  ),
                  createdAt: now,
                };
          const result = await planningActions.saveTaskPlanning({
            taskId,
            scheduledOn:
              planningDraft.scheduleMode === 'date'
                ? planningDraft.scheduledOn
                : null,
            periodStartOn:
              planningDraft.scheduleMode === 'period'
                ? planningDraft.periodStartOn
                : null,
            periodEndOn:
              planningDraft.scheduleMode === 'period'
                ? planningDraft.periodEndOn
                : null,
            blocks: createScheduleBlocksFromDraft(planningDraft, taskId, now),
            recurrence,
          });

          if (result.conflict !== null) {
            setPendingScheduleConflict({
              blocks: createScheduleBlocksFromDraft(planningDraft, taskId, now),
              titles: getScheduleConflictTitles(result.conflict.map(({ block }) => block)),
            });
            return;
          }
        }
      }

      if (type === 'subtask') {
        if (mode === 'create') {
          if (parentTaskId === undefined) {
            throw new Error('Не выбрана задача-родитель');
          }
          await backlogActions.createSubtask({
            id: createItemId(type),
            title,
            description,
            parentTaskId,
            estimatedDurationMinutes,
            createdAt: now,
          });
        } else if (item !== undefined && 'kind' in item && item.kind === 'subtask') {
          await backlogActions.updateTaskItem({
            id: item.id,
            title,
            description,
            estimatedDurationMinutes,
          });
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

        let reminderId: string | null = null;
        if (mode === 'create') {
          const createdReminder = await backlogActions.createReminder({
            id: createItemId(type),
            ...reminderInput,
            createdAt: now,
          });
          reminderId = createdReminder.id;
        } else if (item !== undefined) {
          const updatedReminder = await backlogActions.updateReminder({
            id: item.id,
            ...reminderInput,
          });
          reminderId = updatedReminder.id;
        }

        if (reminderId !== null) {
          await planningActions.saveReminderPlanning({
            reminderId,
            remindsOn: reminderInput.remindsOn,
            periodStartOn: reminderInput.periodStartOn,
            periodEndOn: reminderInput.periodEndOn,
            recurrence: repeatFrequency === ''
              ? null
              : {
                  id: createItemId('recurrence'),
                  frequency: repeatFrequency,
                  interval: Number(repeatInterval),
                  startsOn:
                    reminderInput.remindsOn
                    ?? reminderInput.periodStartOn
                    ?? reminderInput.periodEndOn
                    ?? now.slice(0, 10),
                  createdAt: now,
            },
          });

          if (isReminderTimeEnabled) {
            const taskId = createItemId('task');
            const [block] = createScheduleBlocksFromDraft(
              getReminderTimeDraft(
                reminderBlockDate,
                reminderBlockStartsAt,
                duration,
              ),
              taskId,
              now,
            );
            if (block === undefined) {
              throw new Error('Не удалось создать блок времени');
            }
            setPendingReminderConversion({
              block,
              createdAt: now,
              projectId: selectedProjectId,
              reminderId,
              taskId,
            });
            return;
          }
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

  const resolvePendingScheduleConflict = async (decision: 'cancel' | 'save') => {
    if (pendingScheduleConflict === null) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await planningActions.resolveScheduleConflict({
        decision,
        blocks: pendingScheduleConflict.blocks,
      });
      setPendingScheduleConflict(null);
      if (decision === 'save') {
        onSaved?.();
        onClose();
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось сохранить изменения');
    } finally {
      setIsSaving(false);
    }
  };

  const resolveReminderTimeConversion = async (decision: 'cancel' | 'save') => {
    if (pendingReminderConversion === null) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      if (decision === 'save') {
        await planningActions.convertReminderAndSchedule(pendingReminderConversion);
      }
      setPendingReminderConversion(null);
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
            {canSelectProject ? (
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
                <TextInput
                  accessibilityLabel="Оценочная длительность, мин."
                  keyboardType="number-pad"
                  onChangeText={setDuration}
                  placeholder="Необязательно"
                  placeholderTextColor={designTokens.color.text.tertiary}
                  style={styles.input}
                  value={duration}
                />
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
            {occurrence === undefined ? null : (
              <View>
                <Text style={styles.label}>Применить изменения</Text>
                <View style={styles.repeatOptions}>
                  {([
                    ['Только этот экземпляр', 'instance'],
                    ['Всю серию', 'series'],
                  ] as const).map(([label, value]) => (
                    <Pressable
                      accessibilityRole="button"
                      key={value}
                      onPress={() => setOccurrenceScope(value)}
                      style={[
                        styles.repeatOption,
                        occurrenceScope === value && styles.repeatOptionSelected,
                      ]}>
                      <Text style={[
                        styles.repeatOptionText,
                        occurrenceScope === value && styles.repeatOptionTextSelected,
                      ]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {type === 'reminder' ? (
              <View style={styles.reminderFields}>
                <Text style={styles.label}>Дата</Text>
                <TextInput accessibilityLabel="Дата" onChangeText={setRemindsOn} placeholder="ГГГГ-ММ-ДД" placeholderTextColor={designTokens.color.text.tertiary} style={styles.input} value={remindsOn} />
                <Text style={styles.label}>Начало периода</Text>
                <TextInput accessibilityLabel="Начало периода" onChangeText={setPeriodStartOn} placeholder="ГГГГ-ММ-ДД" placeholderTextColor={designTokens.color.text.tertiary} style={styles.input} value={periodStartOn} />
                <Text style={styles.label}>Конец периода</Text>
                <TextInput accessibilityLabel="Конец периода" onChangeText={setPeriodEndOn} placeholder="ГГГГ-ММ-ДД" placeholderTextColor={designTokens.color.text.tertiary} style={styles.input} value={periodEndOn} />
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
                {isReminderTimeEnabled ? (
                  <View>
                    <Text style={styles.label}>Дата блока</Text>
                    <TextInput accessibilityLabel="Дата блока напоминания" onChangeText={setReminderBlockDate} placeholder="ГГГГ-ММ-ДД" placeholderTextColor={designTokens.color.text.tertiary} style={styles.input} value={reminderBlockDate} />
                    <Text style={styles.label}>Время блока</Text>
                    <TextInput accessibilityLabel="Время блока напоминания" onChangeText={setReminderBlockStartsAt} placeholder="ЧЧ:ММ" placeholderTextColor={designTokens.color.text.tertiary} style={styles.input} value={reminderBlockStartsAt} />
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setReminderBlockDate(
                        remindsOn || periodStartOn || new Date().toISOString().slice(0, 10),
                      );
                      setIsReminderTimeEnabled(true);
                    }}
                    style={styles.addReminderTimeAction}>
                    <Text style={styles.addReminderTimeText}>Добавить время</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
            {error === null ? null : <Text style={styles.error}>{error}</Text>}
          </ScrollView>
          {pendingScheduleConflict === null ? null : (
            <ScheduleConflictConfirmation
              conflictTitles={pendingScheduleConflict.titles}
              onCancel={() => void resolvePendingScheduleConflict('cancel')}
              onSave={() => void resolvePendingScheduleConflict('save')}
            />
          )}
          {pendingReminderConversion === null ? null : (
            <ReminderTimeConfirmation
              onCancel={() => void resolveReminderTimeConversion('cancel')}
              onConfirm={() => void resolveReminderTimeConversion('save')}
            />
          )}
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={[styles.action, styles.secondaryAction]}>
              <Text style={styles.secondaryActionText}>Отмена</Text>
            </Pressable>
            <Pressable
              accessibilityState={{
                disabled: isSaving || pendingScheduleConflict !== null || pendingReminderConversion !== null,
              }}
              disabled={isSaving || pendingScheduleConflict !== null || pendingReminderConversion !== null}
              onPress={() => void submit()}
              style={[
                styles.action,
                styles.primaryAction,
                (isSaving || pendingScheduleConflict !== null || pendingReminderConversion !== null)
                  && styles.disabledAction,
              ]}>
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
  addReminderTimeAction: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginTop: designTokens.space[16],
    minHeight: designTokens.size.touchTargetMin,
  },
  addReminderTimeText: {
    color: designTokens.color.primaryStrong,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
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
