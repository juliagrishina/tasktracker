import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { designTokens } from '../design/tokens';
import { useOptionalAppServices } from '../../application/app-services-provider';
import { getDefaultSettings } from '../../data/default-settings';
import { getDateInTimeZone, getDayLoadPercent, getPlanLoadTone, getTimeInTimeZone } from '../../domain/planning';
import { SurfaceCard } from '../primitives/surface-card';
import { temporaryWebContentStyle } from '../screen-shell';
import { RecurrenceMoveDialog } from './recurrence-move-dialog';
import { RecurrenceScopeDialog } from './recurrence-scope-dialog';
import { CompletionDialog } from './completion-dialog';
import { FollowUpReminderDialog } from './follow-up-reminder-dialog';
import { UnfinishedTaskDialog } from './unfinished-task-dialog';
import { EveningReviewDialog } from './evening-review-dialog';

import { ProgressRing } from './progress-ring';
import { getPlanViewModeLabel, PlanViewControl } from './plan-view-menu';
import type { PlanViewMode } from './plan-period-model';
import { DayTimeline } from './day-timeline';
import type { ScheduleBlock, TaskItem } from '../../domain/entities';
import type { PlanDayReadModel } from '../../application/plan-read-model';
import type { EveningReviewItem } from '../../application/evening-review';

interface DayDashboardProps {
  mode?: PlanViewMode;
  onCreateTask?: () => void;
  onEditTask?: (task: TaskItem) => void;
  onEditRecurrence?: (task: TaskItem, seriesId: string, occursOn: string) => void;
  onRefresh?: () => void;
  onSelectMode?: () => void;
  refreshToken?: number;
  selectedDate?: string;
  dayPlan?: PlanDayReadModel | null;
  now?: Date;
}

export function DayDashboard({ mode = 'day', now, onCreateTask, onEditTask, onEditRecurrence, onRefresh, onSelectMode, refreshToken = 0, selectedDate = new Date().toISOString().slice(0, 10), dayPlan }: DayDashboardProps) {
  const services = useOptionalAppServices();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<readonly import('../../domain/entities').ScheduleBlock[]>([]);
  const [blockTasks, setBlockTasks] = useState<ReadonlyMap<string, TaskItem>>(new Map());
  const [reminders, setReminders] = useState<readonly import('../../application/planning-use-cases').PlanUntimedReminder[]>([]);
  const [untimedTasks, setUntimedTasks] = useState<readonly import('../../application/planning-use-cases').PlanUntimedTask[]>([]);
  const [selectedUntimedTask, setSelectedUntimedTask] = useState<import('../../application/planning-use-cases').PlanUntimedTask | null>(null);
  const [isUntimedMoveDialogVisible, setIsUntimedMoveDialogVisible] = useState(false);
  const [isUntimedRemoveDialogVisible, setIsUntimedRemoveDialogVisible] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState<{ seriesId: string; occursOn: string; task: TaskItem } | null>(null);
  const [isMoveDialogVisible, setIsMoveDialogVisible] = useState(false);
  const [isRemoveDialogVisible, setIsRemoveDialogVisible] = useState(false);
  const [isEditScopeDialogVisible, setIsEditScopeDialogVisible] = useState(false);
  const [selectedReminderOccurrence, setSelectedReminderOccurrence] = useState<{ seriesId: string; occursOn: string } | null>(null);
  const [isReminderMoveDialogVisible, setIsReminderMoveDialogVisible] = useState(false);
  const [isReminderRemoveDialogVisible, setIsReminderRemoveDialogVisible] = useState(false);
  const [completionCandidate, setCompletionCandidate] = useState<{ eligibility: import('../../application/completion-eligibility').CompletionEligibility; task: TaskItem } | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [isUnfinishedDialogVisible, setIsUnfinishedDialogVisible] = useState(false);
  const [followUpCandidate, setFollowUpCandidate] = useState<{ task: TaskItem; linkedOccurrenceOn: string | null; completedOn: string } | null>(null);
  const [completedBlockIds, setCompletedBlockIds] = useState<ReadonlySet<string>>(new Set());
  const [completedUntimedTaskKeys, setCompletedUntimedTaskKeys] = useState<ReadonlySet<string>>(new Set());
  const [isCompleting, setIsCompleting] = useState(false);
  const [eveningReviewItems, setEveningReviewItems] = useState<readonly EveningReviewItem[]>([]);
  const [isEveningReviewVisible, setIsEveningReviewVisible] = useState(false);
  useEffect(() => {
    if (dayPlan !== undefined || services === null) return;
    let isCurrent = true;
    void Promise.all([
      services.planningActions.getPlanScheduleBlocks(selectedDate),
      services.planningActions.getPlanUntimedReminders(selectedDate),
      services.planningActions.getPlanUntimedTasks(selectedDate),
    ]).then(async ([nextBlocks, nextReminders, nextUntimedTasks]) => {
      const taskEntries = await Promise.all([...new Set(nextBlocks.map((block) => block.taskItemId))]
        .map(async (taskId) => [taskId, await services.planningActions.getTaskItem(taskId)] as const));
      if (!isCurrent) return;
      setBlocks(nextBlocks);
      setBlockTasks(new Map(taskEntries.filter((entry): entry is readonly [string, TaskItem] => entry[1] !== null) as readonly (readonly [string, TaskItem])[]));
      setReminders(nextReminders);
      setUntimedTasks(nextUntimedTasks);
    });
    return () => { isCurrent = false; };
  }, [dayPlan, refreshToken, services, selectedDate]);
  useEffect(() => {
    if (services === null) return;
    let isCurrent = true;
    void services.planningActions.getCompletionEligibility(now).then(async (eligible) => {
      const first = eligible[0];
      if (first === undefined) {
        if (isCurrent) setCompletionCandidate(null);
        return;
      }
      const task = await services.planningActions.getTaskItem(first.taskItemId);
      if (isCurrent && task !== null) setCompletionCandidate({ eligibility: first, task });
    });
    return () => { isCurrent = false; };
  }, [now, refreshToken, services]);
  const currentBlocks = useMemo(() => dayPlan === undefined ? blocks : dayPlan?.blocks ?? [], [blocks, dayPlan]);
  const currentBlockTasks = useMemo(() => dayPlan === undefined ? blockTasks : dayPlan?.taskById ?? new Map(), [blockTasks, dayPlan]);
  const currentReminders = useMemo(() => dayPlan === undefined ? reminders : dayPlan?.untimedReminders ?? [], [dayPlan, reminders]);
  const currentUntimedTasks = useMemo(() => dayPlan === undefined ? untimedTasks : dayPlan?.untimedTasks ?? [], [dayPlan, untimedTasks]);
  useEffect(() => {
    if (services === null) return;
    let isCurrent = true;
    void Promise.all(currentBlocks.map(async (block) => {
      const task = currentBlockTasks.get(block.taskItemId);
      if (task?.completedAt !== null && task?.completedAt !== undefined) return block.id;
      const virtual = block.occurrenceId?.split(':');
      const occurrence = virtual?.[0] === 'virtual' && virtual[1] !== undefined && virtual[2] !== undefined
        ? await services.planningActions.getRecurrenceOccurrence(virtual[1], virtual[2])
        : block.occurrenceId === null ? null : await services.planningActions.getRecurrenceOccurrenceById(block.occurrenceId);
      return occurrence?.completedAt === null || occurrence?.completedAt === undefined ? null : block.id;
    })).then((ids) => {
      if (isCurrent) setCompletedBlockIds(new Set(ids.filter((id): id is string => id !== null)));
    });
    return () => { isCurrent = false; };
  }, [currentBlockTasks, currentBlocks, services]);
  useEffect(() => {
    if (services === null) return;
    let isCurrent = true;
    void Promise.all(currentUntimedTasks.map(async (task) => {
      const key = `${task.id}-${task.occursOn ?? 'single'}`;
      if (task.completedAt !== null) return key;
      if (task.seriesId === null || task.occursOn === null) return null;
      const occurrence = await services.planningActions.getRecurrenceOccurrence(task.seriesId, task.occursOn);
      return occurrence?.completedAt === null || occurrence?.completedAt === undefined ? null : key;
    })).then((keys) => {
      if (isCurrent) setCompletedUntimedTaskKeys(new Set(keys.filter((key): key is string => key !== null)));
    });
    return () => { isCurrent = false; };
  }, [currentUntimedTasks, services]);
  const settings = services?.settings ?? getDefaultSettings();
  const estimatedMinutes = useMemo(() => [...currentReminders, ...currentUntimedTasks].reduce((total, item) => total + (item.estimatedDurationMinutes ?? 0), 0), [currentReminders, currentUntimedTasks]);
  const calculatedLoadPercent = useMemo(() => getDayLoadPercent(settings, currentBlocks, selectedDate, estimatedMinutes), [currentBlocks, estimatedMinutes, selectedDate, settings]);
  const loadPercent = dayPlan?.loadPercent ?? calculatedLoadPercent;
  const tone = getPlanLoadTone(loadPercent);
  const timelineBlocks = services === null ? [createDemoTimelineBlock(selectedDate)] : currentBlocks;
  const timelineTitles = services === null
    ? new Map([['demo-plan-task', 'Планёрка команды']])
    : new Map([...currentBlockTasks.entries()].map(([taskId, task]) => [taskId, task.title]));
  const handleBlockPress = (block: ScheduleBlock) => {
    const parts = block.occurrenceId?.split(':');
    const task = currentBlockTasks.get(block.taskItemId);
    if (parts?.[0] === 'virtual' && parts[1] !== undefined && parts[2] !== undefined && task !== undefined) {
      setSelectedOccurrence({ seriesId: parts[1], occursOn: parts[2], task });
      return;
    }
    if (block.occurrenceId !== null && task !== undefined) {
      void services?.planningActions.getRecurrenceOccurrenceById(block.occurrenceId).then((occurrence) => {
        if (occurrence !== null && occurrence !== undefined) setSelectedOccurrence({ seriesId: occurrence.seriesId, occursOn: occurrence.occursOn, task });
        else onEditTask?.(task);
      });
      return;
    }
    if (task !== undefined) onEditTask?.(task);
  };
  const completeCandidate = async () => {
    if (services === null || completionCandidate === null) return;
    setCompletionError(null);
    setIsCompleting(true);
    try {
      const completedAt = (now ?? new Date()).toISOString();
      if (completionCandidate.eligibility.occurrence === null) {
        await services.backlogActions.completeItem({ kind: completionCandidate.task.kind, id: completionCandidate.task.id, completedAt });
      } else {
        await services.planningActions.setRecurrenceOccurrenceState(
          completionCandidate.eligibility.occurrence.seriesId,
          completionCandidate.eligibility.occurrence.occursOn,
          'completed',
        );
      }
      const [nextBlocks, nextReminders, nextUntimedTasks] = await Promise.all([
        services.planningActions.getPlanScheduleBlocks(selectedDate),
        services.planningActions.getPlanUntimedReminders(selectedDate),
        services.planningActions.getPlanUntimedTasks(selectedDate),
      ]);
      const taskEntries = await Promise.all([...new Set(nextBlocks.map((block) => block.taskItemId))]
        .map(async (taskId) => [taskId, await services.planningActions.getTaskItem(taskId)] as const));
      setBlocks(nextBlocks);
      setBlockTasks(new Map(taskEntries.filter((entry): entry is readonly [string, TaskItem] => entry[1] !== null) as readonly (readonly [string, TaskItem])[]));
      setReminders(nextReminders);
      setUntimedTasks(nextUntimedTasks);
      setCompletionCandidate(null);
      setFollowUpCandidate({
        task: completionCandidate.task,
        linkedOccurrenceOn: completionCandidate.eligibility.occurrence?.occursOn ?? null,
        completedOn: getDateInTimeZone(completedAt, settings.timeZoneId),
      });
      setFeedback('Дело завершено');
      onRefresh?.();
    } catch (caughtError) {
      setCompletionError(caughtError instanceof Error ? caughtError.message : 'Не удалось завершить дело');
    } finally {
      setIsCompleting(false);
    }
  };
  const createFollowUpReminder = async (remindsOn: string) => {
    if (services === null || followUpCandidate === null) return;
    setCompletionError(null);
    setIsCompleting(true);
    try {
      await services.backlogActions.createFollowUpReminder({
        id: `follow-up-${followUpCandidate.task.id}-${followUpCandidate.linkedOccurrenceOn ?? 'single'}`,
        taskItemId: followUpCandidate.task.id,
        taskTitle: followUpCandidate.task.title,
        linkedOccurrenceOn: followUpCandidate.linkedOccurrenceOn,
        remindsOn,
        createdAt: (now ?? new Date()).toISOString(),
      });
      setFollowUpCandidate(null);
      setFeedback('Связанное напоминание создано');
      onRefresh?.();
    } catch (caughtError) {
      setCompletionError(caughtError instanceof Error ? caughtError.message : 'Не удалось создать напоминание');
    } finally {
      setIsCompleting(false);
    }
  };
  const handleUnfinishedMove = () => {
    if (completionCandidate === null) return;
    const { eligibility, task } = completionCandidate;
    setCompletionCandidate(null);
    setIsUnfinishedDialogVisible(false);
    if (eligibility.occurrence === null) onEditTask?.(task);
    else onEditRecurrence?.(task, eligibility.occurrence.seriesId, eligibility.occurrence.occursOn);
  };
  const openEveningReview = async () => {
    if (services === null) return;
    setEveningReviewItems(await services.planningActions.getEveningReviewItems(selectedDate));
    setIsEveningReviewVisible(true);
  };
  const continueCandidate = async () => {
    if (services === null || completionCandidate === null) return;
    setCompletionError(null);
    setIsCompleting(true);
    try {
      await services.planningActions.continueIncompleteTask({ taskId: completionCandidate.task.id, occurrence: completionCandidate.eligibility.occurrence, now: now ?? new Date() });
      setBlocks(await services.planningActions.getPlanScheduleBlocks(selectedDate));
      setCompletionCandidate(null);
      setIsUnfinishedDialogVisible(false);
      setFeedback('Дело продлено на 30 минут');
      if (completionCandidate.eligibility.occurrence === null) onEditTask?.(completionCandidate.task);
      else onEditRecurrence?.(completionCandidate.task, completionCandidate.eligibility.occurrence.seriesId, completionCandidate.eligibility.occurrence.occursOn);
      onRefresh?.();
    } catch (caughtError) {
      setCompletionError(caughtError instanceof Error ? caughtError.message : 'Не удалось продлить дело');
    } finally {
      setIsCompleting(false);
    }
  };
  const returnCandidateToBacklog = async (reason: string | null) => {
    if (services === null || completionCandidate === null) return;
    setCompletionError(null);
    setIsCompleting(true);
    try {
      await services.planningActions.returnIncompleteTaskToBacklog({ taskId: completionCandidate.task.id, occurrence: completionCandidate.eligibility.occurrence, reason });
      setBlocks(await services.planningActions.getPlanScheduleBlocks(selectedDate));
      setCompletionCandidate(null);
      setIsUnfinishedDialogVisible(false);
      setFeedback('Дело возвращено в Backlog');
      onRefresh?.();
    } catch (caughtError) {
      setCompletionError(caughtError instanceof Error ? caughtError.message : 'Не удалось вернуть дело в Backlog');
    } finally {
      setIsCompleting(false);
    }
  };
  const title = selectedDate === getCurrentLocalDate() ? 'Сегодня' : 'План';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerSurface}>
        <View style={[styles.headerContent, temporaryWebContentStyle()]}>
          <View>
            <Text style={styles.screenTitle}>{title}</Text>
            <Text style={styles.date}>{selectedDate}</Text>
          </View>
          <View style={styles.headerActions}>
            <PlanViewControl
              mode={mode}
              onPress={() => {
                if (onSelectMode === undefined) {
                  setFeedback(`Режим «${getPlanViewModeLabel(mode)}» выбран`);
                  return;
                }
                onSelectMode();
              }}
            />
            <Pressable
              accessibilityLabel="Обновить план"
              accessibilityRole="button"
              onPress={() => { onRefresh?.(); setFeedback('Данные плана обновлены'); }}
              style={({ pressed }) => [styles.refreshControl, pressed && styles.pressed]}>
              <Ionicons color={designTokens.color.text.primary} name="refresh" size={18} />
            </Pressable>
            <Pressable
              accessibilityLabel="Открыть вечернюю проверку"
              accessibilityRole="button"
              onPress={() => void openEveningReview()}
              style={({ pressed }) => [styles.refreshControl, pressed && styles.pressed]}>
              <Ionicons color={designTokens.color.text.primary} name="moon-outline" size={18} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, temporaryWebContentStyle()]}>
        <SurfaceCard style={styles.hero} tone="info">
          <View style={styles.heroRow}>
            <ProgressRing label={`${Math.round(loadPercent)}%`} value={Math.min(100, loadPercent)} />
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{tone === 'high' ? 'Высокая загрузка' : tone === 'medium' ? 'Средняя загрузка' : 'План в норме'}</Text>
              <Text style={styles.heroDetail}>{Math.round(loadPercent)}% · {currentBlocks.length} {currentBlocks.length === 1 ? 'блок' : 'блоков'}</Text>
              <View style={styles.loadTrack}>
                <View style={[styles.loadValue, { width: `${Math.min(100, loadPercent)}%` }]} />
              </View>
            </View>
          </View>
          {currentBlocks[0] === undefined ? null : <SurfaceCard style={styles.nextEvent}>
            <Text style={styles.nextDetail}>{formatBlockTime(currentBlocks[0], settings.timeZoneId)}</Text>
            <Text style={styles.nextTitle}>Ближайший временной блок</Text>
          </SurfaceCard>}
        </SurfaceCard>

        <SectionHeader action={`${currentReminders.length + currentUntimedTasks.length}`} title="Без времени" />
        <View style={styles.list}>
          {currentUntimedTasks.map((task) => { const key = `${task.id}-${task.occursOn ?? 'single'}`; return <PlanListRow completed={completedUntimedTaskKeys.has(key)} key={key} onPress={() => { if (task.seriesId === null && onEditTask !== undefined) onEditTask(task); else setSelectedUntimedTask(task); }} title={task.title} time="Без времени" />; })}
          {currentReminders.map((reminder) => <PlanListRow key={reminder.id} onPress={() => setSelectedReminderOccurrence(reminder.seriesId === null || reminder.occursOn === null ? null : { seriesId: reminder.seriesId, occursOn: reminder.occursOn })} title={reminder.title} time="Без времени" />)}
        </View>
        <SectionHeader action={`${currentBlocks.length} ${currentBlocks.length === 1 ? 'блок' : 'блоков'}`} title="Расписание" />
        <DayTimeline blocks={timelineBlocks} completedBlockIds={completedBlockIds} onPressBlock={handleBlockPress} selectedDate={selectedDate} timeZoneId={settings.timeZoneId} titleByTaskId={timelineTitles} />
        {selectedUntimedTask === null ? null : <View style={styles.occurrenceActions}>
          <Text style={styles.sectionTitle}>Запланированная задача</Text>
          <Pressable accessibilityLabel="Вернуть задачу в Backlog" onPress={() => { if (services !== null) void services.planningActions.returnTaskToBacklog({ taskId: selectedUntimedTask.id, reason: null }).then(() => services.planningActions.getPlanUntimedTasks(selectedDate).then((nextTasks) => { setUntimedTasks(nextTasks); setSelectedUntimedTask(null); onRefresh?.(); })); }} style={styles.occurrenceButton}><Text style={styles.occurrenceText}>Вернуть в Backlog</Text></Pressable>
          {selectedUntimedTask.seriesId === null || selectedUntimedTask.occursOn === null ? null : <><Pressable accessibilityLabel="Завершить безвременный экземпляр" onPress={() => { if (services !== null) void services.planningActions.setRecurrenceOccurrenceState(selectedUntimedTask.seriesId!, selectedUntimedTask.occursOn!, 'completed').then(() => services.planningActions.getPlanUntimedTasks(selectedDate).then((nextTasks) => { setUntimedTasks(nextTasks); setSelectedUntimedTask(null); onRefresh?.(); })); }} style={styles.occurrenceButton}><Text style={styles.occurrenceText}>Завершить</Text></Pressable><Pressable accessibilityLabel="Отменить безвременное повторение" onPress={() => setIsUntimedRemoveDialogVisible(true)} style={styles.occurrenceButton}><Text style={styles.occurrenceText}>Отменить</Text></Pressable><Pressable accessibilityLabel="Перенести безвременный экземпляр" onPress={() => setIsUntimedMoveDialogVisible(true)} style={styles.occurrenceButton}><Text style={styles.occurrenceText}>Перенести</Text></Pressable></>}
        </View>}
        {selectedReminderOccurrence === null ? null : <View style={styles.occurrenceActions}>
          <Text style={styles.sectionTitle}>Этот экземпляр напоминания</Text>
          <Pressable accessibilityLabel="Завершить экземпляр напоминания" onPress={() => { if (services !== null) void services.planningActions.setRecurrenceOccurrenceState(selectedReminderOccurrence.seriesId, selectedReminderOccurrence.occursOn, 'completed').then(() => services.planningActions.getPlanUntimedReminders(selectedDate).then((nextReminders) => { setReminders(nextReminders); setSelectedReminderOccurrence(null); onRefresh?.(); })); }} style={styles.occurrenceButton}><Text style={styles.occurrenceText}>Завершить</Text></Pressable>
          <Pressable accessibilityLabel="Отменить повторение напоминания" onPress={() => setIsReminderRemoveDialogVisible(true)} style={styles.occurrenceButton}><Text style={styles.occurrenceText}>Отменить</Text></Pressable><Pressable accessibilityLabel="Перенести экземпляр напоминания" onPress={() => setIsReminderMoveDialogVisible(true)} style={styles.occurrenceButton}><Text style={styles.occurrenceText}>Перенести</Text></Pressable>
        </View>}
        {selectedOccurrence === null ? null : <View style={styles.occurrenceActions}>
          <Text style={styles.sectionTitle}>Этот экземпляр</Text>
          <Pressable accessibilityLabel="Редактировать повторение" onPress={() => setIsEditScopeDialogVisible(true)} style={styles.occurrenceButton}><Text style={styles.occurrenceText}>Редактировать</Text></Pressable>
          <Pressable accessibilityLabel="Завершить этот экземпляр" onPress={() => { if (services !== null) void services.planningActions.setRecurrenceOccurrenceState(selectedOccurrence.seriesId, selectedOccurrence.occursOn, 'completed').then(() => services.planningActions.getPlanScheduleBlocks(selectedDate).then((nextBlocks) => { setBlocks(nextBlocks); onRefresh?.(); })); }} style={styles.occurrenceButton}><Text style={styles.occurrenceText}>Завершить</Text></Pressable>
          <Pressable accessibilityLabel="Отменить повторение" onPress={() => setIsRemoveDialogVisible(true)} style={styles.occurrenceButton}><Text style={styles.occurrenceText}>Отменить</Text></Pressable>
          <Pressable accessibilityLabel="Перенести этот экземпляр" onPress={() => setIsMoveDialogVisible(true)} style={styles.occurrenceButton}><Text style={styles.occurrenceText}>Перенести</Text></Pressable>
        </View>}

        {feedback === null ? null : <Text accessibilityLiveRegion="polite" style={styles.feedback}>{feedback}</Text>}
      </ScrollView>

      <Pressable
        accessibilityLabel="Добавить в план"
        accessibilityRole="button"
        onPress={() => {
          if (onCreateTask === undefined) {
            setFeedback('Добавление в план доступно в демо-режиме');
            return;
          }
          onCreateTask();
        }}
        style={({ pressed }) => [styles.floatingAction, pressed && styles.pressed]}>
        <Ionicons color={designTokens.color.text.inverse} name="add" size={28} />
      </Pressable>
      {selectedOccurrence === null ? null : (
        <RecurrenceMoveDialog
          key={selectedOccurrence.occursOn}
          occursOn={selectedOccurrence.occursOn}
          onMove={async (targetDate, scope) => {
            if (services === null) return;
            await services.planningActions.moveRecurrenceOccurrence({ seriesId: selectedOccurrence.seriesId, occursOn: selectedOccurrence.occursOn, targetDate, scope });
            setBlocks(await services.planningActions.getPlanScheduleBlocks(selectedDate));
            onRefresh?.();
            setSelectedOccurrence(null);
            setIsMoveDialogVisible(false);
          }}
          onRequestClose={() => setIsMoveDialogVisible(false)}
          visible={isMoveDialogVisible}
        />
      )}
      {selectedOccurrence === null ? null : <RecurrenceScopeDialog actionLabel="Отменить повторение" onChoose={async (scope) => { if (services === null) return; await services.planningActions.removeRecurrenceOccurrence({ seriesId: selectedOccurrence.seriesId, occursOn: selectedOccurrence.occursOn, scope }); setBlocks(await services.planningActions.getPlanScheduleBlocks(selectedDate)); onRefresh?.(); setSelectedOccurrence(null); setIsRemoveDialogVisible(false); }} onRequestClose={() => setIsRemoveDialogVisible(false)} visible={isRemoveDialogVisible} />}
      {selectedOccurrence === null ? null : <RecurrenceScopeDialog actionLabel="Редактировать повторение" onChoose={async (scope) => { if (scope === 'occurrence') onEditRecurrence?.(selectedOccurrence.task, selectedOccurrence.seriesId, selectedOccurrence.occursOn); else onEditTask?.(selectedOccurrence.task); setSelectedOccurrence(null); setIsEditScopeDialogVisible(false); }} onRequestClose={() => setIsEditScopeDialogVisible(false)} visible={isEditScopeDialogVisible} />}
      {selectedReminderOccurrence === null ? null : <RecurrenceScopeDialog actionLabel="Отменить повторение напоминания" onChoose={async (scope) => { if (services === null) return; await services.planningActions.removeRecurrenceOccurrence({ ...selectedReminderOccurrence, scope }); setReminders(await services.planningActions.getPlanUntimedReminders(selectedDate)); onRefresh?.(); setSelectedReminderOccurrence(null); setIsReminderRemoveDialogVisible(false); }} onRequestClose={() => setIsReminderRemoveDialogVisible(false)} visible={isReminderRemoveDialogVisible} />}
      {selectedReminderOccurrence === null ? null : <RecurrenceMoveDialog key={`reminder-${selectedReminderOccurrence.occursOn}`} occursOn={selectedReminderOccurrence.occursOn} onMove={async (targetDate, scope) => { if (services === null) return; await services.planningActions.moveRecurrenceOccurrence({ ...selectedReminderOccurrence, targetDate, scope }); setReminders(await services.planningActions.getPlanUntimedReminders(selectedDate)); onRefresh?.(); setSelectedReminderOccurrence(null); setIsReminderMoveDialogVisible(false); }} onRequestClose={() => setIsReminderMoveDialogVisible(false)} visible={isReminderMoveDialogVisible} />}
      {selectedUntimedTask === null || selectedUntimedTask.seriesId === null || selectedUntimedTask.occursOn === null ? null : <RecurrenceMoveDialog key={`untimed-${selectedUntimedTask.occursOn}`} occursOn={selectedUntimedTask.occursOn} onMove={async (targetDate, scope) => { if (services === null) return; await services.planningActions.moveRecurrenceOccurrence({ seriesId: selectedUntimedTask.seriesId!, occursOn: selectedUntimedTask.occursOn!, targetDate, scope }); setUntimedTasks(await services.planningActions.getPlanUntimedTasks(selectedDate)); onRefresh?.(); setSelectedUntimedTask(null); setIsUntimedMoveDialogVisible(false); }} onRequestClose={() => setIsUntimedMoveDialogVisible(false)} visible={isUntimedMoveDialogVisible} />}
      {selectedUntimedTask === null || selectedUntimedTask.seriesId === null || selectedUntimedTask.occursOn === null ? null : <RecurrenceScopeDialog actionLabel="Отменить повторение" onChoose={async (scope) => { if (services === null) return; await services.planningActions.removeRecurrenceOccurrence({ seriesId: selectedUntimedTask.seriesId!, occursOn: selectedUntimedTask.occursOn!, scope }); setUntimedTasks(await services.planningActions.getPlanUntimedTasks(selectedDate)); onRefresh?.(); setSelectedUntimedTask(null); setIsUntimedRemoveDialogVisible(false); }} onRequestClose={() => setIsUntimedRemoveDialogVisible(false)} visible={isUntimedRemoveDialogVisible} />}
      {completionCandidate === null ? null : <CompletionDialog error={completionError} isCompleting={isCompleting} onComplete={() => void completeCandidate()} onRequestClose={() => { if (!isCompleting) setCompletionCandidate(null); }} onUnfinished={() => { if (!isCompleting) setIsUnfinishedDialogVisible(true); }} taskTitle={completionCandidate.task.title} visible={!isUnfinishedDialogVisible} />}
      {completionCandidate === null ? null : <UnfinishedTaskDialog error={completionError} isActing={isCompleting} onContinue={() => void continueCandidate()} onMove={handleUnfinishedMove} onRequestClose={() => { if (!isCompleting) setIsUnfinishedDialogVisible(false); }} onReturnToBacklog={(reason) => void returnCandidateToBacklog(reason)} taskTitle={completionCandidate.task.title} visible={isUnfinishedDialogVisible} />}
      {followUpCandidate === null ? null : <FollowUpReminderDialog completedOn={followUpCandidate.completedOn} error={completionError} isCreating={isCompleting} onCreate={(remindsOn) => void createFollowUpReminder(remindsOn)} onSkip={() => { if (!isCompleting) setFollowUpCandidate(null); }} taskTitle={followUpCandidate.task.title} visible />}
      <EveningReviewDialog items={eveningReviewItems} onRequestClose={() => setIsEveningReviewVisible(false)} visible={isEveningReviewVisible} />
    </SafeAreaView>
  );
}

function getCurrentLocalDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatBlockTime(block: import('../../domain/entities').ScheduleBlock, timeZoneId: string): string {
  return `${getTimeInTimeZone(block.startsAt, timeZoneId)}–${getTimeInTimeZone(block.endsAt, timeZoneId)}`;
}

function createDemoTimelineBlock(selectedDate: string): ScheduleBlock {
  return {
    id: 'demo-plan-block',
    taskItemId: 'demo-plan-task',
    occurrenceId: null,
    timeZoneId: 'Europe/Moscow',
    startsAt: `${selectedDate}T10:00:00+03:00`,
    endsAt: `${selectedDate}T10:30:00+03:00`,
    createdAt: `${selectedDate}T00:00:00.000Z`,
    updatedAt: `${selectedDate}T00:00:00.000Z`,
    deletedAt: null,
  };
}

function SectionHeader({ action, title }: { action: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionAction}>{action}</Text>
    </View>
  );
}

function PlanListRow({ completed = false, onPress, title, time }: { completed?: boolean; onPress: () => void; title: string; time: string }) {
  return (
    <Pressable accessibilityLabel={`${time}: ${title}${completed ? ', выполнено' : ''}`} disabled={completed} onPress={onPress}><SurfaceCard style={[styles.listRow, completed && styles.completedListRow]}>
      <Text style={styles.time}>{time}</Text>
      <View style={[styles.dot, completed && styles.completedDot]} />
      <View style={styles.listCopy}>
        <Text numberOfLines={1} style={[styles.listTitle, completed && styles.completedListText]}>{completed ? `✓ ${title}` : title}</Text>
        <Text numberOfLines={1} style={[styles.listDetail, completed && styles.completedListText]}>{completed ? 'Выполнено' : 'Точно запланировано'}</Text>
      </View>
    </SurfaceCard></Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: designTokens.color.surface.canvas,
  },
  headerSurface: {
    backgroundColor: designTokens.color.surface.raised,
    borderBottomColor: designTokens.color.border.subtle,
    borderBottomWidth: 1,
  },
  headerContent: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: designTokens.space[16],
    paddingVertical: designTokens.space[12],
  },
  screenTitle: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.screenTitle,
    fontWeight: designTokens.typography.weight.bold,
    letterSpacing: designTokens.typography.tracking.title,
    lineHeight: designTokens.typography.lineHeight.screenTitle,
  },
  date: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
    marginTop: designTokens.space[2],
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: designTokens.space[4],
  },
  refreshControl: {
    alignItems: 'center',
    backgroundColor: designTokens.color.surface.subtle,
    borderRadius: designTokens.radius.pill,
    height: designTokens.size.touchTargetMin,
    justifyContent: 'center',
    width: designTokens.size.touchTargetMin,
  },
  scrollContent: {
    paddingBottom: designTokens.space[32] + designTokens.size.floatingAction + designTokens.space[24],
    paddingHorizontal: designTokens.space[16],
    paddingTop: designTokens.space[12],
  },
  hero: {
    padding: designTokens.space[12],
  },
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: designTokens.space[12],
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.body,
  },
  heroDetail: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
    marginTop: designTokens.space[2],
  },
  loadTrack: {
    backgroundColor: designTokens.color.calendar.progressTrack,
    borderRadius: designTokens.radius.pill,
    height: designTokens.space[8],
    marginTop: designTokens.space[6],
    overflow: 'hidden',
  },
  loadValue: {
    backgroundColor: designTokens.color.feedback.warning.border,
    borderRadius: designTokens.radius.pill,
    height: '100%',
    width: '63%',
  },
  nextEvent: {
    marginTop: designTokens.space[10],
    padding: designTokens.space[10],
  },
  nextDetail: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  nextTitle: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
    marginTop: designTokens.space[2],
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: designTokens.space[16],
    paddingHorizontal: designTokens.space[2],
  },
  sectionTitle: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  sectionAction: {
    color: designTokens.color.primary,
    fontSize: designTokens.typography.size.meta,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  list: {
    gap: designTokens.space[6],
    marginTop: designTokens.space[6],
  },
  occurrenceActions: { gap: designTokens.space[8], marginTop: designTokens.space[16] },
  occurrenceButton: { alignItems: 'center', backgroundColor: designTokens.color.primarySoft, borderRadius: designTokens.radius.control, justifyContent: 'center', minHeight: designTokens.size.touchTargetMin },
  occurrenceText: { color: designTokens.color.primaryStrong, fontWeight: designTokens.typography.weight.semibold },
  listRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: designTokens.space[8],
    padding: designTokens.space[10],
  },
  completedListRow: {
    backgroundColor: designTokens.color.surface.subtle,
  },
  time: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.micro,
    lineHeight: designTokens.typography.lineHeight.micro,
    width: designTokens.space[32] + designTokens.space[8],
  },
  dot: {
    backgroundColor: designTokens.color.feedback.success.base,
    borderRadius: designTokens.radius.pill,
    height: designTokens.space[8],
    width: designTokens.space[8],
  },
  completedDot: {
    backgroundColor: designTokens.color.text.tertiary,
  },
  meetingDot: {
    backgroundColor: designTokens.color.meeting.accent,
  },
  listCopy: {
    flex: 1,
  },
  listTitle: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  listDetail: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
    marginTop: designTokens.space[2],
  },
  completedListText: {
    color: designTokens.color.text.tertiary,
    textDecorationLine: 'line-through',
  },
  feedback: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
    marginTop: designTokens.space[12],
    textAlign: 'center',
  },
  floatingAction: {
    alignItems: 'center',
    backgroundColor: designTokens.color.primary,
    borderRadius: designTokens.radius.pill,
    bottom: designTokens.space[16],
    height: designTokens.size.floatingAction,
    justifyContent: 'center',
    position: 'absolute',
    right: designTokens.space[16],
    width: designTokens.size.floatingAction,
    ...designTokens.elevation.floatingAction,
  },
  pressed: {
    opacity: designTokens.state.pressedOpacity,
  },
});
