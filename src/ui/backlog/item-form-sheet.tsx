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
import { PlanningDatePicker } from './planning-date-picker';
import {
  PlanningValuePicker,
  type PlanningValueOption,
} from './planning-value-picker';

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
    initialBlockIds?: readonly string[];
    initialDraft?: TaskPlanningDraft;
    seriesInitialBlockIds?: readonly string[];
    seriesDraft?: TaskPlanningDraft;
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

function getInitialReminderValue(
  item: FormItem | undefined,
  key: 'remindsOn' | 'periodStartOn' | 'periodEndOn',
  occurrenceDate?: string,
): string {
  if (item !== undefined && 'remindsOn' in item) {
    if (key === 'remindsOn' && occurrenceDate !== undefined) {
      return occurrenceDate;
    }
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

type ReminderScheduleMode = 'none' | 'date' | 'period';
type ReminderOpenDatePicker = 'scheduled' | 'period-start' | 'period-end' | 'exact' | null;

const estimateOptions: readonly PlanningValueOption[] = [
  { label: 'Без оценки', value: '' },
  ...Array.from({ length: 96 }, (_, index) => {
    const minutes = (index + 1) * 5;
    return { label: `${minutes} мин`, value: String(minutes) };
  }),
];

const timeOptions: readonly PlanningValueOption[] = Array.from({ length: 24 * 12 }, (_, index) => {
  const hours = Math.floor(index / 12);
  const minutes = (index % 12) * 5;
  const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { label: value, value };
});

function getTimeMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match === null ? null : Number(match[1]) * 60 + Number(match[2]);
}

function formatEndTime(totalMinutes: number): string {
  const normalized = totalMinutes % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return totalMinutes >= 24 * 60 ? `${time} · следующий день` : time;
}

function createReminderEndTimeOptions(startsAt: string): readonly PlanningValueOption[] {
  const startMinutes = getTimeMinutes(startsAt);
  if (startMinutes === null) {
    return [];
  }
  return Array.from({ length: 96 }, (_, index) => {
    const value = startMinutes + (index + 1) * 5;
    return { label: formatEndTime(value), value: String(value) };
  });
}

function getInitialReminderScheduleMode(item: FormItem | undefined, occurrenceDate?: string): ReminderScheduleMode {
  if (item !== undefined && 'remindsOn' in item && occurrenceDate !== undefined) {
    return 'date';
  }
  if (item !== undefined && 'remindsOn' in item && item.remindsOn !== null) {
    return 'date';
  }
  if (
    item !== undefined
    && 'remindsOn' in item
    && item.periodStartOn !== null
    && item.periodEndOn !== null
  ) {
    return 'period';
  }
  return 'none';
}

function getLocalIsoDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface PendingScheduleConflict {
  blocks: readonly ScheduleBlock[];
  deletedBlockIds: readonly string[];
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
  const occurrenceDate = planningContext?.occurrence?.occursOn;
  const [remindsOn, setRemindsOn] = useState(() => getInitialReminderValue(item, 'remindsOn', occurrenceDate));
  const [periodStartOn, setPeriodStartOn] = useState(() => getInitialReminderValue(item, 'periodStartOn'));
  const [periodEndOn, setPeriodEndOn] = useState(() => getInitialReminderValue(item, 'periodEndOn'));
  const [reminderScheduleMode, setReminderScheduleMode] = useState<ReminderScheduleMode>(
    () => getInitialReminderScheduleMode(item, occurrenceDate),
  );
  const [reminderOpenDatePicker, setReminderOpenDatePicker] = useState<ReminderOpenDatePicker>(null);
  const [repeatFrequency, setRepeatFrequency] = useState<'' | 'daily' | 'weekly' | 'monthly'>(() => getInitialRepeatFrequency(item));
  const [repeatInterval, setRepeatInterval] = useState(() => getInitialRepeatInterval(item));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [planningDraft, setPlanningDraft] = useState<TaskPlanningDraft>(
    () => planningContext?.initialDraft ?? createInitialTaskPlanningDraft(),
  );
  const [planningTaskId, setPlanningTaskId] = useState<string | null>(null);
  const [pendingScheduleConflict, setPendingScheduleConflict] = useState<PendingScheduleConflict | null>(null);
  const [occurrenceScope, setOccurrenceScope] = useState<'instance' | 'series' | null>(null);
  const [isReminderTimeEnabled, setIsReminderTimeEnabled] = useState(false);
  const [reminderBlockDate, setReminderBlockDate] = useState('');
  const [reminderBlockStartsAt, setReminderBlockStartsAt] = useState('');
  const [reminderBlockEndMinutes, setReminderBlockEndMinutes] = useState('');
  const [pendingReminderConversion, setPendingReminderConversion] = useState<PendingReminderConversion | null>(null);
  const defaultBlock = useMemo(
    () => createDefaultBlock(planningContext?.defaultDate ?? getLocalIsoDate(), new Date()),
    [planningContext?.defaultDate],
  );
  const isPlanTaskForm = (type === 'task' || type === 'subtask') && planningContext !== undefined;
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
      if (type === 'reminder') {
        const reminderPlanningError = validateTaskPlanningDraft({
          ...createInitialTaskPlanningDraft(),
          scheduleMode: reminderScheduleMode,
          scheduledOn: reminderScheduleMode === 'date' ? remindsOn : '',
          periodStartOn: reminderScheduleMode === 'period' ? periodStartOn : '',
          periodEndOn: reminderScheduleMode === 'period' ? periodEndOn : '',
          repeatFrequency: repeatFrequency === '' ? 'none' : repeatFrequency,
          repeatInterval,
        });
        if (reminderPlanningError !== null) {
          throw new Error(reminderPlanningError.replace('задачи', 'напоминания'));
        }
        if (occurrence !== undefined && occurrenceScope === null) {
          throw new Error('Выберите область изменения повторения');
        }
      }
      if (type === 'reminder' && isReminderTimeEnabled) {
        const startMinutes = getTimeMinutes(reminderBlockStartsAt);
        const exactDurationMinutes = startMinutes === null
          ? 0
          : Number(reminderBlockEndMinutes) - startMinutes;
        const planningError = validateTaskPlanningDraft(
          getReminderTimeDraft(
            reminderBlockDate,
            reminderBlockStartsAt,
            String(exactDurationMinutes),
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

        if (isPlanTaskForm && occurrence !== undefined && occurrenceScope === null) {
          throw new Error('Выберите область изменения повторения');
        }

        if (
          isPlanTaskForm
          && occurrence !== undefined
          && occurrenceScope === 'instance'
          && mode === 'edit'
          && item !== undefined
          && 'kind' in item
          && item.kind === 'task'
        ) {
          const occurrenceBlocks = createScheduleBlocksFromDraft(planningDraft, item.id, now)
            .map((block) => ({ ...block, occurrenceId: occurrence.id }));
          await planningActions.saveOccurrenceException({
            id: occurrence.id,
            seriesId: occurrence.seriesId,
            occursOn: occurrence.occursOn,
            status: 'active',
            taskPatch: {
              title,
              description: emptyToNull(description),
              scheduledOn: planningDraft.scheduleMode === 'date' ? planningDraft.scheduledOn : null,
              periodStartOn: planningDraft.scheduleMode === 'period' ? planningDraft.periodStartOn : null,
              periodEndOn: planningDraft.scheduleMode === 'period' ? planningDraft.periodEndOn : null,
              estimatedDurationMinutes,
            },
            blocks: occurrenceBlocks,
            createdAt: now,
          });
          onSaved?.();
          onClose();
          return;
        }

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
          const scheduleBlocks = createScheduleBlocksFromDraft(planningDraft, taskId, now);
          const initialBlockIds = occurrenceScope === 'series'
            ? planningContext.seriesInitialBlockIds ?? planningContext.initialBlockIds
            : planningContext.initialBlockIds;
          const deletedBlockIds = initialBlockIds?.filter(
            (blockId) => !scheduleBlocks.some((block) => block.id === blockId),
          ) ?? [];
          const recurrence = occurrenceScope === 'series'
            && planningDraft.repeatFrequency === 'none'
            && planningContext.seriesDraft === undefined
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
            estimatedDurationMinutes,
            blocks: scheduleBlocks,
            deletedBlockIds,
            recurrence,
          });

          if (result.conflict !== null) {
            setPendingScheduleConflict({
              blocks: scheduleBlocks,
              deletedBlockIds,
              titles: getScheduleConflictTitles(result.conflict.map(({ block }) => block)),
            });
            return;
          }
        }
      }

      if (type === 'subtask') {
        let subtaskId: string | null = null;
        if (isPlanTaskForm && occurrence !== undefined && occurrenceScope === null) {
          throw new Error('Выберите область изменения повторения');
        }
        if (mode === 'create') {
          if (parentTaskId === undefined) {
            throw new Error('Не выбрана задача-родитель');
          }
          const createdSubtask = await backlogActions.createSubtask({
            id: createItemId(type),
            title,
            description,
            parentTaskId,
            estimatedDurationMinutes,
            createdAt: now,
          });
          subtaskId = createdSubtask.id;
        } else if (item !== undefined && 'kind' in item && item.kind === 'subtask') {
          subtaskId = item.id;
          await backlogActions.updateTaskItem({
            id: item.id,
            title,
            description,
            estimatedDurationMinutes,
          });
        }

        if (isPlanTaskForm && subtaskId !== null) {
          const scheduleBlocks = createScheduleBlocksFromDraft(planningDraft, subtaskId, now);
          const initialBlockIds = occurrenceScope === 'series'
            ? planningContext.seriesInitialBlockIds ?? planningContext.initialBlockIds
            : planningContext.initialBlockIds;
          const deletedBlockIds = initialBlockIds?.filter(
            (blockId) => !scheduleBlocks.some((block) => block.id === blockId),
          ) ?? [];
          if (occurrence !== undefined && occurrenceScope === 'instance') {
            await planningActions.saveOccurrenceException({
              id: occurrence.id,
              seriesId: occurrence.seriesId,
              occursOn: occurrence.occursOn,
              status: 'active',
              taskPatch: {
                title,
                description: emptyToNull(description),
                scheduledOn: planningDraft.scheduleMode === 'date' ? planningDraft.scheduledOn : null,
                periodStartOn: planningDraft.scheduleMode === 'period' ? planningDraft.periodStartOn : null,
                periodEndOn: planningDraft.scheduleMode === 'period' ? planningDraft.periodEndOn : null,
                estimatedDurationMinutes,
              },
              blocks: scheduleBlocks.map((block) => ({ ...block, occurrenceId: occurrence.id })),
              createdAt: now,
            });
            onSaved?.();
            onClose();
            return;
          }
          const recurrence = occurrenceScope === 'series'
            && planningDraft.repeatFrequency === 'none'
            && planningContext.seriesDraft === undefined
            ? undefined
            : planningDraft.repeatFrequency === 'none'
            ? null
            : {
                id: occurrence?.seriesId ?? createItemId('recurrence'),
                frequency: planningDraft.repeatFrequency,
                interval: Number(planningDraft.repeatInterval),
                startsOn: getRecurrenceStartOn(planningDraft, planningContext.defaultDate),
                createdAt: now,
              };
          const result = await planningActions.saveTaskPlanning({
            taskId: subtaskId,
            scheduledOn: planningDraft.scheduleMode === 'date' ? planningDraft.scheduledOn : null,
            periodStartOn: planningDraft.scheduleMode === 'period' ? planningDraft.periodStartOn : null,
            periodEndOn: planningDraft.scheduleMode === 'period' ? planningDraft.periodEndOn : null,
            estimatedDurationMinutes,
            blocks: scheduleBlocks,
            deletedBlockIds,
            recurrence,
          });
          if (result.conflict !== null) {
            setPendingScheduleConflict({
              blocks: scheduleBlocks,
              deletedBlockIds,
              titles: getScheduleConflictTitles(result.conflict.map(({ block }) => block)),
            });
            return;
          }
        }
      }

      if (type === 'reminder') {
        const repeatRule = repeatFrequency === ''
          ? null
          : { frequency: repeatFrequency, interval: Number(repeatInterval) };
        const reminderInput = {
          title,
          remindsOn: reminderScheduleMode === 'date' ? emptyToNull(remindsOn) : null,
          periodStartOn: reminderScheduleMode === 'period' ? emptyToNull(periodStartOn) : null,
          periodEndOn: reminderScheduleMode === 'period' ? emptyToNull(periodEndOn) : null,
          repeatRule,
          estimatedDurationMinutes,
        };

        if (occurrence !== undefined && occurrenceScope === 'instance') {
          await planningActions.saveOccurrenceException({
            id: occurrence.id,
            seriesId: occurrence.seriesId,
            occursOn: occurrence.occursOn,
            status: 'active',
            reminderPatch: {
              title,
              remindsOn: reminderInput.remindsOn,
              periodStartOn: reminderInput.periodStartOn,
              periodEndOn: reminderInput.periodEndOn,
              estimatedDurationMinutes,
            },
            createdAt: now,
          });
          onSaved?.();
          onClose();
          return;
        }

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
            estimatedDurationMinutes,
            recurrence: repeatFrequency === ''
              ? null
              : {
                  id: occurrence?.seriesId ?? createItemId('recurrence'),
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
                String(Number(reminderBlockEndMinutes) - (getTimeMinutes(reminderBlockStartsAt) ?? 0)),
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
        deletedBlockIds: pendingScheduleConflict.deletedBlockIds,
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

  const cancelOccurrence = async () => {
    if (occurrence === undefined) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await planningActions.saveOccurrenceException({
        id: occurrence.id,
        seriesId: occurrence.seriesId,
        occursOn: occurrence.occursOn,
        status: 'cancelled',
        createdAt: new Date().toISOString(),
      });
      onSaved?.();
      onClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u044d\u043a\u0437\u0435\u043c\u043f\u043b\u044f\u0440');
    } finally {
      setIsSaving(false);
    }
  };

  const completeOccurrence = async () => {
    if (occurrence === undefined) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const completedAt = new Date().toISOString();
      await planningActions.saveOccurrenceException({
        id: occurrence.id,
        seriesId: occurrence.seriesId,
        occursOn: occurrence.occursOn,
        status: 'completed',
        completedAt,
        createdAt: completedAt,
      });
      onSaved?.();
      onClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось завершить экземпляр');
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
                <Text style={styles.label}>Оценочная длительность</Text>
                <PlanningValuePicker
                  accessibilityLabel="Оценочная длительность"
                  onChange={setDuration}
                  options={estimateOptions}
                  placeholder="Без оценки"
                  title="Выберите оценочную длительность"
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
                      accessibilityLabel={label}
                      accessibilityRole="button"
                      accessibilityState={{ selected: occurrenceScope === value }}
                      key={value}
                      onPress={() => {
                        setOccurrenceScope(value);
                        if (value === 'series' && planningContext?.seriesDraft !== undefined) {
                          setPlanningDraft(planningContext.seriesDraft);
                        }
                        if (value === 'instance' && planningContext?.initialDraft !== undefined) {
                          setPlanningDraft(planningContext.initialDraft);
                        }
                        if (type === 'reminder') {
                          if (value === 'series') {
                            setReminderScheduleMode(getInitialReminderScheduleMode(item));
                            setRemindsOn(getInitialReminderValue(item, 'remindsOn'));
                            setPeriodStartOn(getInitialReminderValue(item, 'periodStartOn'));
                            setPeriodEndOn(getInitialReminderValue(item, 'periodEndOn'));
                          } else if (occurrence !== undefined) {
                            setReminderScheduleMode('date');
                            setRemindsOn(occurrence.occursOn);
                            setPeriodStartOn('');
                            setPeriodEndOn('');
                          }
                        }
                      }}
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
                <Pressable
                  accessibilityLabel="Завершить этот экземпляр"
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={() => void completeOccurrence()}
                  style={[styles.completeOccurrenceAction, isSaving && styles.disabledAction]}>
                  <Text style={styles.completeOccurrenceText}>Завершить этот экземпляр</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={'\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u044d\u0442\u043e\u0442 \u044d\u043a\u0437\u0435\u043c\u043f\u043b\u044f\u0440'}
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={() => void cancelOccurrence()}
                  style={[styles.cancelOccurrenceAction, isSaving && styles.disabledAction]}>
                  <Text style={styles.cancelOccurrenceText}>{'\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u044d\u0442\u043e\u0442 \u044d\u043a\u0437\u0435\u043c\u043f\u043b\u044f\u0440'}</Text>
                </Pressable>
              </View>
            )}
            {type === 'reminder' ? (
              <View style={styles.reminderFields}>
                <Text style={styles.sectionTitle}>Планирование</Text>
                <Text style={styles.helper}>Напоминание можно сохранить на дату или период без точного времени.</Text>
                <View style={styles.repeatOptions}>
                  {([['Без даты', 'none'], ['Дата', 'date'], ['Период', 'period']] as const).map(([label, value]) => (
                    <Pressable
                      accessibilityLabel={label}
                      accessibilityRole="button"
                      accessibilityState={{ selected: reminderScheduleMode === value }}
                      key={value}
                      onPress={() => {
                        setReminderScheduleMode(value);
                        if (value === 'date') {
                          setRemindsOn(remindsOn || planningContext?.defaultDate || getLocalIsoDate());
                          setReminderOpenDatePicker('scheduled');
                        } else if (value === 'period') {
                          const fallbackDate = planningContext?.defaultDate || getLocalIsoDate();
                          setPeriodStartOn(periodStartOn || fallbackDate);
                          setPeriodEndOn(periodEndOn || fallbackDate);
                          setReminderOpenDatePicker('period-start');
                        } else {
                          setReminderOpenDatePicker(null);
                        }
                      }}
                      style={[styles.repeatOption, reminderScheduleMode === value && styles.repeatOptionSelected]}>
                      <Text style={[styles.repeatOptionText, reminderScheduleMode === value && styles.repeatOptionTextSelected]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                {reminderScheduleMode === 'date' ? (
                  <View>
                    <Text style={styles.label}>Дата напоминания</Text>
                    <PlanningDatePicker
                      accessibilityLabel="Дата напоминания"
                      onChange={(value) => {
                        setRemindsOn(value);
                        setReminderOpenDatePicker(null);
                      }}
                      onVisibleChange={(visible) => setReminderOpenDatePicker(visible ? 'scheduled' : null)}
                      value={remindsOn}
                      visible={reminderOpenDatePicker === 'scheduled'}
                    />
                  </View>
                ) : null}
                {reminderScheduleMode === 'period' ? (
                  <View>
                    <Text style={styles.label}>Начало периода</Text>
                    <PlanningDatePicker
                      accessibilityLabel="Начало периода напоминания"
                      onChange={(value) => {
                        setPeriodStartOn(value);
                        if (periodEndOn < value) {
                          setPeriodEndOn(value);
                        }
                        setReminderOpenDatePicker('period-end');
                      }}
                      onVisibleChange={(visible) => setReminderOpenDatePicker(visible ? 'period-start' : null)}
                      value={periodStartOn}
                      visible={reminderOpenDatePicker === 'period-start'}
                    />
                    <Text style={styles.label}>Конец периода</Text>
                    <PlanningDatePicker
                      accessibilityLabel="Конец периода напоминания"
                      minimumValue={periodStartOn || undefined}
                      onChange={(value) => {
                        setPeriodEndOn(value);
                        setReminderOpenDatePicker(null);
                      }}
                      onVisibleChange={(visible) => setReminderOpenDatePicker(visible ? 'period-end' : null)}
                      value={periodEndOn}
                      visible={reminderOpenDatePicker === 'period-end'}
                    />
                  </View>
                ) : null}
                <Text style={styles.label}>Повторение</Text>
                <View style={styles.repeatOptions}>
                  {([
                    ['Нет', ''],
                    ['Каждый день', 'daily'],
                    ['Каждую неделю', 'weekly'],
                    ['Каждый месяц', 'monthly'],
                  ] as const).map(([label, value]) => (
                    <Pressable
                      accessibilityLabel={label}
                      accessibilityRole="button"
                      accessibilityState={{ selected: repeatFrequency === value }}
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
                  <View style={styles.exactTimeSection}>
                    <Text style={styles.label}>Дата точного времени</Text>
                    <PlanningDatePicker
                      accessibilityLabel="Дата точного времени"
                      onChange={(value) => {
                        setReminderBlockDate(value);
                        setReminderOpenDatePicker(null);
                      }}
                      onVisibleChange={(visible) => setReminderOpenDatePicker(visible ? 'exact' : null)}
                      value={reminderBlockDate}
                      visible={reminderOpenDatePicker === 'exact'}
                    />
                    <View style={styles.exactTimeValues}>
                      <View style={styles.exactTimeValue}>
                        <Text style={styles.label}>Начало</Text>
                        <PlanningValuePicker
                          accessibilityLabel="Начало точного времени"
                          onChange={(value) => {
                            setReminderBlockStartsAt(value);
                            const minutes = getTimeMinutes(value);
                            setReminderBlockEndMinutes(minutes === null ? '' : String(minutes + 60));
                          }}
                          options={timeOptions}
                          title="Выберите время начала"
                          value={reminderBlockStartsAt}
                        />
                      </View>
                      <View style={styles.exactTimeValue}>
                        <Text style={styles.label}>Конец</Text>
                        <PlanningValuePicker
                          accessibilityLabel="Конец точного времени"
                          disabled={getTimeMinutes(reminderBlockStartsAt) === null}
                          onChange={setReminderBlockEndMinutes}
                          options={createReminderEndTimeOptions(reminderBlockStartsAt)}
                          title="Выберите время окончания"
                          value={reminderBlockEndMinutes}
                        />
                      </View>
                    </View>
                    <Pressable
                      accessibilityLabel="Убрать точное время"
                      accessibilityRole="button"
                      onPress={() => setIsReminderTimeEnabled(false)}
                      style={styles.removeReminderTimeAction}>
                      <Text style={styles.removeReminderTimeText}>Убрать точное время</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    accessibilityLabel="Добавить точное время"
                    accessibilityRole="button"
                    onPress={() => {
                      const startsAtMinutes = getTimeMinutes(defaultBlock.startsAt) ?? 0;
                      setReminderBlockDate(
                        remindsOn || periodStartOn || planningContext?.defaultDate || getLocalIsoDate(),
                      );
                      setReminderBlockStartsAt(defaultBlock.startsAt);
                      setReminderBlockEndMinutes(String(startsAtMinutes + 60));
                      setIsReminderTimeEnabled(true);
                    }}
                    style={styles.addReminderTimeAction}>
                    <Text style={styles.addReminderTimeText}>Добавить точное время</Text>
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
              <Text style={styles.primaryActionText}>{isSaving ? 'Сохранение…' : mode === 'edit' ? 'Сохранить' : isPlanTaskForm ? 'Создать' : 'Сохранить'}</Text>
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
  sectionTitle: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.sectionTitle,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.sectionTitle,
    marginTop: designTokens.space[20],
  },
  helper: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
    marginTop: designTokens.space[4],
  },
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
  exactTimeSection: {
    backgroundColor: designTokens.color.surface.subtle,
    borderRadius: designTokens.radius.row,
    marginTop: designTokens.space[16],
    padding: designTokens.space[12],
  },
  exactTimeValues: { flexDirection: 'row', gap: designTokens.space[8] },
  exactTimeValue: { flex: 1 },
  removeReminderTimeAction: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
    marginTop: designTokens.space[8],
  },
  removeReminderTimeText: {
    color: designTokens.color.feedback.danger.foreground,
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
  cancelOccurrenceAction: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
    marginTop: designTokens.space[8],
  },
  completeOccurrenceAction: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
    marginTop: designTokens.space[8],
  },
  completeOccurrenceText: {
    color: designTokens.color.feedback.success.foreground,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  cancelOccurrenceText: {
    color: designTokens.color.feedback.danger.foreground,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
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
