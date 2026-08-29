import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { designTokens } from '../design/tokens';
import { useOptionalAppServices } from '../../application/app-services-provider';
import type { RecurrenceOccurrence, Reminder, TaskItem } from '../../domain/entities';
import { loadPlanReadModel, type PlanReadModel } from '../../application/plan-read-model';
import { temporaryWebContentStyle } from '../screen-shell';
import { ItemFormSheet } from '../backlog/item-form-sheet';
import { DayDashboard } from './day-dashboard';
import {
  formatPlanMonth,
  formatPlanWeekRange,
  getMonthLoadDays,
  getWeekLoadDays,
  shiftPlanAnchor,
  type PlanViewMode,
} from './plan-period-model';
import { PlanPeriodNavigator } from './plan-period-navigator';
import { PlanViewControl, PlanViewMenu } from './plan-view-menu';
import { MonthLoadGrid } from './month-load-grid';
import { WeekLoadList } from './week-load-list';
import { DailyEnergyCheckIn } from './daily-energy-check-in';

interface PlanScreenProps {
  initialDate?: string;
}

interface RecurrenceTaskEditor {
  occurrence: RecurrenceOccurrence | null;
  occursOn: string;
  seriesId: string;
  task: TaskItem;
}

type PlanActionableItem = TaskItem | Reminder;

function getActionableItemKind(item: PlanActionableItem): 'task' | 'subtask' | 'reminder' {
  return 'kind' in item ? item.kind : 'reminder';
}

function getCurrentLocalDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function PlanScreen({ initialDate }: PlanScreenProps) {
  const services = useOptionalAppServices();
  const [mode, setMode] = useState<PlanViewMode>('day');
  const [isModeMenuVisible, setIsModeMenuVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => initialDate ?? getCurrentLocalDate());
  const [isTaskSheetVisible, setIsTaskSheetVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [editingOccurrence, setEditingOccurrence] = useState<RecurrenceTaskEditor | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [planReadModel, setPlanReadModel] = useState<PlanReadModel | null>(null);
  const [isManualEnergyCheckInVisible, setIsManualEnergyCheckInVisible] = useState(false);

  useEffect(() => {
    if (services === null) return;
    let isCurrent = true;
    const dates = mode === 'week'
      ? getWeekLoadDays(selectedDate).map((day) => day.isoDate)
      : mode === 'month'
        ? getMonthLoadDays(selectedDate).flat().filter((day): day is NonNullable<typeof day> => day !== null).map((day) => day.isoDate)
        : [selectedDate];
    void loadPlanReadModel(services.planningActions, services.settings, dates)
      .then((nextPlanReadModel) => { if (isCurrent) setPlanReadModel(nextPlanReadModel); })
      .catch(() => { if (isCurrent) setPlanReadModel(null); });
    return () => { isCurrent = false; };
  }, [mode, refreshToken, selectedDate, services]);

  const activePlanReadModel = services === null ? null : planReadModel;

  const selectDate = (isoDate: string) => {
    setSelectedDate(isoDate);
    setMode('day');
  };

  const completePlanItem = async (item: PlanActionableItem) => {
    if (services === null) return;
    await services.backlogActions.completeItem({ kind: getActionableItemKind(item), id: item.id, completedAt: new Date().toISOString() });
  };

  const resumePlanItem = async (item: PlanActionableItem) => {
    if (services === null) return;
    await services.backlogActions.resumeItem({ kind: getActionableItemKind(item), id: item.id });
  };

  const deletePlanItem = async (item: PlanActionableItem) => {
    if (services === null) return;
    await services.backlogActions.deleteItem({ kind: getActionableItemKind(item), id: item.id, confirmed: true });
    setEditingTask(null);
    setEditingReminder(null);
    setRefreshToken((value) => value + 1);
  };

  return (
    <>
      {mode === 'day' ? (
        <DayDashboard
          mode={mode}
          onCreateTask={() => setIsTaskSheetVisible(true)}
          onEditReminder={setEditingReminder}
          onEditTask={setEditingTask}
          onEditRecurrence={(task, seriesId, occursOn) => {
            if (services === null) return;
            void services.planningActions.getRecurrenceOccurrence(seriesId, occursOn).then((occurrence) => setEditingOccurrence({ task, seriesId, occursOn, occurrence }));
          }}
          onEditDailyEnergy={() => setIsManualEnergyCheckInVisible(true)}
          onRefresh={() => { setRefreshToken((value) => value + 1); }}
          refreshToken={refreshToken}
          dayPlan={services === null ? undefined : activePlanReadModel?.byDate[selectedDate] ?? null}
          onSelectMode={() => setIsModeMenuVisible(true)}
          selectedDate={selectedDate}
        />
      ) : (
        <PeriodPlanView
          mode={mode}
          onChangeAnchor={(amount) => setSelectedDate((currentDate) => shiftPlanAnchor(currentDate, mode, amount))}
          onCreateTask={() => setIsTaskSheetVisible(true)}
          onSelectDate={selectDate}
          onSelectMode={() => setIsModeMenuVisible(true)}
          onSelectToday={() => setSelectedDate(getCurrentLocalDate())}
          selectedDate={selectedDate}
          getLoadPercent={(date) => activePlanReadModel?.byDate[date]?.loadPercent ?? 0}
        />
      )}
      <PlanViewMenu
        mode={mode}
        onRequestClose={() => setIsModeMenuVisible(false)}
        onSelectMode={setMode}
        visible={isModeMenuVisible}
      />
      {services === null ? null : <DailyEnergyCheckIn
        initialEnergyPercent={services.dailyEnergy?.energyPercent}
        onRequestClose={() => setIsManualEnergyCheckInVisible(false)}
        onSave={async (energyPercent) => { await services.energyActions.saveDailyEnergy(energyPercent); }}
        onSkip={services.isDailyEnergyLoaded && services.dailyEnergy === null ? async () => { await services.energyActions.saveDailyEnergy(null); } : undefined}
        visible={services.isDailyEnergyLoaded && (services.dailyEnergy === null || isManualEnergyCheckInVisible)}
      />}
      {isTaskSheetVisible ? (
        <ItemFormSheet
          mode="create"
          onClose={() => setIsTaskSheetVisible(false)}
          planningContext={{ defaultDate: selectedDate }}
          onSaved={() => setRefreshToken((value) => value + 1)}
          type="task"
          visible
        />
      ) : null}
      {editingTask !== null ? (
        <ItemFormSheet
          item={editingTask}
          mode="edit"
          onComplete={completePlanItem}
          onResume={resumePlanItem}
          onClose={() => setEditingTask(null)}
          onDelete={deletePlanItem}
          planningContext={{ defaultDate: selectedDate }}
          onSaved={() => { setEditingTask(null); setRefreshToken((value) => value + 1); }}
          type={editingTask.kind}
          visible
        />
      ) : null}
      {editingReminder !== null ? (
        <ItemFormSheet
          item={editingReminder}
          mode="edit"
          onComplete={completePlanItem}
          onResume={resumePlanItem}
          onClose={() => setEditingReminder(null)}
          onDelete={deletePlanItem}
          onSaved={() => { setEditingReminder(null); setRefreshToken((value) => value + 1); }}
          type="reminder"
          visible
        />
      ) : null}
      {editingOccurrence !== null ? (
        <ItemFormSheet
          item={{ ...editingOccurrence.task, ...editingOccurrence.occurrence?.taskPatch, completedAt: editingOccurrence.occurrence?.completedAt ?? editingOccurrence.task.completedAt }}
          mode="edit"
          onComplete={async () => { if (services === null) return; await services.planningActions.setRecurrenceOccurrenceState(editingOccurrence.seriesId, editingOccurrence.occursOn, 'completed'); }}
          onResume={async () => { if (services === null) return; await services.planningActions.setRecurrenceOccurrenceState(editingOccurrence.seriesId, editingOccurrence.occursOn, 'active'); setRefreshToken((value) => value + 1); }}
          occurrenceEdit={{
            onSave: async ({ title, description, estimatedDurationMinutes }) => {
              if (services === null) return;
              const now = new Date().toISOString();
              const existing = editingOccurrence.occurrence;
              await services.planningActions.saveOccurrenceException({
                occurrence: {
                  id: existing?.id ?? `occurrence-${editingOccurrence.seriesId}-${editingOccurrence.occursOn}`,
                  seriesId: editingOccurrence.seriesId,
                  occursOn: editingOccurrence.occursOn,
                  cancelledAt: existing?.cancelledAt ?? null,
                  completedAt: existing?.completedAt ?? null,
                  blocksOverridden: existing?.blocksOverridden ?? false,
                  taskPatch: {
                    ...existing?.taskPatch,
                    title,
                    description: description.trim() === '' ? null : description,
                    estimatedDurationMinutes,
                  },
                  reminderPatch: null,
                  createdAt: existing?.createdAt ?? now,
                  updatedAt: now,
                  deletedAt: existing?.deletedAt ?? null,
                },
              });
            },
          }}
          onClose={() => setEditingOccurrence(null)}
          onDelete={async () => { if (services === null) return; await services.planningActions.removeRecurrenceOccurrence({ seriesId: editingOccurrence.seriesId, occursOn: editingOccurrence.occursOn, scope: 'occurrence' }); setEditingOccurrence(null); setRefreshToken((value) => value + 1); }}
          onSaved={() => { setEditingOccurrence(null); setRefreshToken((value) => value + 1); }}
          type={editingOccurrence.task.kind}
          visible
        />
      ) : null}
    </>
  );
}

function PeriodPlanView({
  mode,
  onChangeAnchor,
  onCreateTask,
  onSelectDate,
  onSelectMode,
  onSelectToday,
  selectedDate,
  getLoadPercent,
}: {
  mode: Exclude<PlanViewMode, 'day'>;
  onChangeAnchor: (amount: number) => void;
  onCreateTask: () => void;
  onSelectDate: (isoDate: string) => void;
  onSelectMode: () => void;
  onSelectToday: () => void;
  selectedDate: string;
  getLoadPercent: (isoDate: string) => number;
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
          onToday={onSelectToday}
          previousAccessibilityLabel={navigationLabels.previous}
        />
        <View style={styles.periodContent}>
          {isWeek ? (
            <WeekLoadList days={getWeekLoadDays(selectedDate, getLoadPercent)} onSelectDate={onSelectDate} selectedDate={selectedDate} />
          ) : (
            <MonthLoadGrid onSelectDate={onSelectDate} selectedDate={selectedDate} weeks={getMonthLoadDays(selectedDate, getLoadPercent)} />
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
  scrollContent: {
    paddingBottom: designTokens.space[32] + designTokens.size.floatingAction + designTokens.space[24],
    paddingHorizontal: designTokens.space[16],
    paddingTop: designTokens.space[12],
  },
  periodContent: {
    marginTop: designTokens.space[8],
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
