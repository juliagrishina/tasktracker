import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DayPlan, DayPlanBlock, DayPlanOccurrence, PlanLoadDay } from '../../application/plan-load-selector';
import { useAppServices } from '../../application/app-services-provider';
import type { TaskPlanningSnapshot } from '../../application/planning-use-cases';
import type { Reminder, TaskItem } from '../../domain/entities';
import {
  createInitialTaskPlanningDraft,
  type TaskPlanningDraft,
} from '../backlog/task-planning-fields';
import { ItemFormSheet } from '../backlog/item-form-sheet';
import { designTokens } from '../design/tokens';
import { temporaryWebContentStyle } from '../screen-shell';

import { DayDashboard } from './day-dashboard';
import {
  formatPlanMonth,
  formatPlanWeekRange,
  shiftPlanAnchor,
  toMonthLoadWeeks,
  type PlanViewMode,
} from './plan-period-model';
import { PlanPeriodNavigator } from './plan-period-navigator';
import { PlanViewControl, PlanViewMenu } from './plan-view-menu';
import { MonthLoadGrid } from './month-load-grid';
import { WeekLoadList } from './week-load-list';

interface PlanScreenProps {
  initialDate?: string;
}

function getLocalIsoDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createBlockDraft(block: DayPlanBlock): TaskPlanningDraft {
  const sourceBlock = block.sourceBlock ?? block;
  const startsAt = new Date(sourceBlock.startsAt);
  const endsAt = new Date(sourceBlock.endsAt);
  const durationMinutes = Math.max(5, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000));
  const recurrence = block.occurrence;
  return {
    ...createInitialTaskPlanningDraft(),
    blocks: [{
      id: sourceBlock.id,
      date: sourceBlock.startsAt.slice(0, 10),
      startsAt: sourceBlock.startsAt.slice(11, 16),
      durationMinutes: String(durationMinutes),
    }],
    scheduleMode: 'date',
    scheduledOn: block.startsAt.slice(0, 10),
    repeatFrequency: recurrence?.frequency ?? 'none',
    repeatInterval: String(recurrence?.interval ?? 1),
  };
}

function createSeriesDraft(task: TaskItem, snapshot: TaskPlanningSnapshot): TaskPlanningDraft {
  return {
    ...createInitialTaskPlanningDraft(),
    blocks: snapshot.blocks.map((block) => ({
      id: block.id,
      date: block.startsAt.slice(0, 10),
      startsAt: block.startsAt.slice(11, 16),
      durationMinutes: String(Math.max(5, Math.round(
        (new Date(block.endsAt).getTime() - new Date(block.startsAt).getTime()) / 60_000,
      ))),
    })),
    scheduleMode: task.scheduledOn !== null
      ? 'date'
      : task.periodStartOn !== null && task.periodEndOn !== null
        ? 'period'
        : 'none',
    scheduledOn: task.scheduledOn ?? '',
    periodStartOn: task.periodStartOn ?? '',
    periodEndOn: task.periodEndOn ?? '',
    repeatFrequency: snapshot.recurrence?.frequency ?? 'none',
    repeatInterval: String(snapshot.recurrence?.interval ?? 1),
  };
}

export function PlanScreen({ initialDate = getLocalIsoDate() }: PlanScreenProps) {
  const { plan, planningActions, refreshPlan } = useAppServices();
  const [mode, setMode] = useState<PlanViewMode>('day');
  const [isModeMenuVisible, setIsModeMenuVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [isTaskSheetVisible, setIsTaskSheetVisible] = useState(false);
  const [editingPlanItem, setEditingPlanItem] = useState<{
    item: TaskItem | Reminder;
    occurrence?: DayPlanOccurrence;
    block?: DayPlanBlock;
    initialDraft?: TaskPlanningDraft;
    seriesInitialBlockIds?: readonly string[];
    seriesDraft?: TaskPlanningDraft;
  } | null>(null);
  const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
  const [periodDays, setPeriodDays] = useState<readonly PlanLoadDay[]>([]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      if (mode === 'day') {
        setDayPlan(null);
        const nextDayPlan = await planningActions.getDayPlan(selectedDate);
        if (isMounted) {
          setDayPlan(nextDayPlan);
        }
        return;
      }

      setPeriodDays([]);
      const nextPeriodDays = await planningActions.getPlanLoadDays(selectedDate, mode);
      if (isMounted) {
        setPeriodDays(nextPeriodDays);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [mode, plan.revision, planningActions, selectedDate]);

  const selectDate = (isoDate: string) => {
    setSelectedDate(isoDate);
    setMode('day');
  };
  const openItemEditor = async (
    item: TaskItem | Reminder,
    occurrence?: DayPlanOccurrence,
    block?: DayPlanBlock,
  ) => {
    if (!('kind' in item)) {
      setEditingPlanItem({ item, occurrence });
      return;
    }

    const snapshot = await planningActions.getTaskPlanningSnapshot(item.id);
    const seriesDraft = createSeriesDraft(item, snapshot);
    setEditingPlanItem({
      item,
      occurrence,
      block,
      initialDraft: occurrence !== undefined && block !== undefined
        ? createBlockDraft(block)
        : occurrence !== undefined
          ? {
              ...seriesDraft,
              scheduleMode: 'date',
              scheduledOn: occurrence.occursOn,
              periodStartOn: '',
              periodEndOn: '',
              blocks: [],
            }
          : seriesDraft,
      seriesInitialBlockIds: snapshot.blocks.map((entry) => entry.id),
      seriesDraft,
    });
  };

  return (
    <>
      {mode === 'day' ? (
        <DayDashboard
          dayPlan={dayPlan}
          mode={mode}
          onCreateTask={() => setIsTaskSheetVisible(true)}
          onEditItem={(item, occurrence, block) => void openItemEditor(item, occurrence, block)}
          onRefresh={() => void refreshPlan()}
          onSelectMode={() => setIsModeMenuVisible(true)}
          selectedDate={selectedDate}
        />
      ) : (
        <PeriodPlanView
          days={periodDays}
          mode={mode}
          onChangeAnchor={(amount) => setSelectedDate((currentDate) => shiftPlanAnchor(currentDate, mode, amount))}
          onCreateTask={() => setIsTaskSheetVisible(true)}
          onSelectDate={selectDate}
          onSelectMode={() => setIsModeMenuVisible(true)}
          selectedDate={selectedDate}
        />
      )}
      <PlanViewMenu
        mode={mode}
        onRequestClose={() => setIsModeMenuVisible(false)}
        onSelectMode={setMode}
        visible={isModeMenuVisible}
      />
      {isTaskSheetVisible ? (
        <ItemFormSheet
          mode="create"
          onClose={() => setIsTaskSheetVisible(false)}
          planningContext={{ defaultDate: selectedDate }}
          type="task"
          visible
        />
      ) : editingPlanItem !== null ? (
        <ItemFormSheet
          item={editingPlanItem.item}
          mode="edit"
          onClose={() => setEditingPlanItem(null)}
          planningContext={{
            defaultDate: selectedDate,
            initialBlockIds: editingPlanItem.initialDraft?.blocks.map((entry) => entry.id) ?? [],
            initialDraft: editingPlanItem.initialDraft,
            seriesInitialBlockIds: editingPlanItem.seriesInitialBlockIds,
            seriesDraft: editingPlanItem.seriesDraft,
            occurrence: editingPlanItem.occurrence,
          }}
          type={'kind' in editingPlanItem.item ? editingPlanItem.item.kind : 'reminder'}
          visible
        />
      ) : null}
    </>
  );
}

function PeriodPlanView({
  days,
  mode,
  onChangeAnchor,
  onCreateTask,
  onSelectDate,
  onSelectMode,
  selectedDate,
}: {
  days: readonly PlanLoadDay[];
  mode: Exclude<PlanViewMode, 'day'>;
  onChangeAnchor: (amount: number) => void;
  onCreateTask: () => void;
  onSelectDate: (isoDate: string) => void;
  onSelectMode: () => void;
  selectedDate: string;
}) {
  const isWeek = mode === 'week';
  const periodLabel = isWeek ? formatPlanWeekRange(selectedDate) : formatPlanMonth(selectedDate);
  const navigationLabels = isWeek
    ? { next: 'Следующая неделя', previous: 'Предыдущая неделя' }
    : { next: 'Следующий месяц', previous: 'Предыдущий месяц' };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerSurface}>
        <View style={[styles.headerContent, temporaryWebContentStyle()]}>
          <View>
            <Text style={styles.screenTitle}>План</Text>
            <Text style={styles.date}>{periodLabel}</Text>
          </View>
          <PlanViewControl mode={mode} onPress={onSelectMode} />
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.scrollContent, temporaryWebContentStyle()]}>
        <PlanPeriodNavigator
          label={periodLabel}
          nextAccessibilityLabel={navigationLabels.next}
          onNext={() => onChangeAnchor(1)}
          onPrevious={() => onChangeAnchor(-1)}
          previousAccessibilityLabel={navigationLabels.previous}
        />
        <View style={styles.periodContent}>
          {isWeek ? (
            <WeekLoadList days={days} onSelectDate={onSelectDate} selectedDate={selectedDate} />
          ) : (
            <MonthLoadGrid onSelectDate={onSelectDate} selectedDate={selectedDate} weeks={toMonthLoadWeeks(selectedDate, days)} />
          )}
        </View>
      </ScrollView>
      <Pressable
        accessibilityLabel="Добавить в план"
        accessibilityRole="button"
        onPress={onCreateTask}
        style={({ pressed }) => [styles.floatingAction, pressed && styles.pressed]}>
        <Ionicons color={designTokens.color.text.inverse} name="add" size={28} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: designTokens.color.surface.canvas },
  headerSurface: {
    backgroundColor: designTokens.color.surface.raised,
    borderBottomColor: designTokens.color.border.subtle,
    borderBottomWidth: 1,
  },
  headerContent: {
    alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: designTokens.space[16], paddingVertical: designTokens.space[12],
  },
  screenTitle: {
    color: designTokens.color.text.primary, fontSize: designTokens.typography.size.screenTitle,
    fontWeight: designTokens.typography.weight.bold, letterSpacing: designTokens.typography.tracking.title,
    lineHeight: designTokens.typography.lineHeight.screenTitle,
  },
  date: {
    color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta, marginTop: designTokens.space[2],
  },
  scrollContent: {
    paddingBottom: designTokens.space[32] + designTokens.size.floatingAction + designTokens.space[24],
    paddingHorizontal: designTokens.space[16], paddingTop: designTokens.space[12],
  },
  periodContent: { marginTop: designTokens.space[8] },
  floatingAction: {
    alignItems: 'center', backgroundColor: designTokens.color.primary, borderRadius: designTokens.radius.pill,
    bottom: designTokens.space[16], height: designTokens.size.floatingAction, justifyContent: 'center',
    position: 'absolute', right: designTokens.space[16], width: designTokens.size.floatingAction,
    ...designTokens.elevation.floatingAction,
  },
  pressed: { opacity: designTokens.state.pressedOpacity },
});
