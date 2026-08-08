import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { designTokens } from '../design/tokens';
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

const demoSelectedDate = '2026-08-05';

export function PlanScreen() {
  const [mode, setMode] = useState<PlanViewMode>('day');
  const [isModeMenuVisible, setIsModeMenuVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(demoSelectedDate);
  const [isTaskSheetVisible, setIsTaskSheetVisible] = useState(false);

  const selectDate = (isoDate: string) => {
    setSelectedDate(isoDate);
    setMode('day');
  };

  return (
    <>
      {mode === 'day' ? (
        <DayDashboard
          mode={mode}
          onCreateTask={() => setIsTaskSheetVisible(true)}
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
  selectedDate,
}: {
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
            <WeekLoadList days={getWeekLoadDays(selectedDate)} onSelectDate={onSelectDate} selectedDate={selectedDate} />
          ) : (
            <MonthLoadGrid onSelectDate={onSelectDate} selectedDate={selectedDate} weeks={getMonthLoadDays(selectedDate)} />
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
