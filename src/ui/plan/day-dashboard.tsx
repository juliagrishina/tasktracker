import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DayPlan, DayPlanBlock, DayPlanOccurrence } from '../../application/plan-load-selector';
import type { TaskItem } from '../../domain/entities';
import { designTokens } from '../design/tokens';
import { SurfaceCard } from '../primitives/surface-card';
import { temporaryWebContentStyle } from '../screen-shell';

import { ProgressRing } from './progress-ring';
import { formatPlanDate, formatPlanLoadPercent, getPlanLoadTone, type PlanViewMode } from './plan-period-model';
import { getPlanViewModeLabel, PlanViewControl } from './plan-view-menu';

interface DayDashboardProps {
  dayPlan: DayPlan | null;
  mode?: PlanViewMode;
  onCreateTask?: () => void;
  onEditTask?: (task: TaskItem, occurrence?: DayPlanOccurrence, block?: DayPlanBlock) => void;
  onRefresh?: () => void;
  onSelectMode?: () => void;
  selectedDate: string;
}

interface DayListItem {
  id: string;
  title: string;
  detail: string;
  kind: 'task' | 'reminder' | 'block';
  task?: TaskItem;
  occurrence?: DayPlanOccurrence;
  block?: DayPlanBlock;
}

function getPlanStatus(loadPercent: number): string {
  const tone = getPlanLoadTone(loadPercent);
  if (tone === 'low') return 'План в норме';
  if (tone === 'medium') return 'План почти заполнен';
  return 'План перегружен';
}

function formatBlockTime(isoDateTime: string): string {
  return isoDateTime.slice(11, 16);
}

export function DayDashboard({
  dayPlan,
  mode = 'day',
  onCreateTask,
  onEditTask,
  onRefresh,
  onSelectMode,
  selectedDate,
}: DayDashboardProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const loadPercent = dayPlan?.loadPercent ?? 0;
  const scheduledItems: readonly DayListItem[] = dayPlan?.blocks.map((block) => ({
    id: block.id,
    title: block.title,
    detail: `${formatBlockTime(block.startsAt)}–${formatBlockTime(block.endsAt)}${block.description === null ? '' : ` · ${block.description}`}`,
    kind: 'block',
    task: block.task,
    occurrence: block.occurrence,
    block,
  })) ?? [];
  const untimedItems: readonly DayListItem[] = dayPlan === null
    ? []
    : [
        ...dayPlan.untimedTasks.map((task) => ({
          id: task.id,
          title: task.title,
          detail: task.description ?? 'Задача',
          kind: 'task' as const,
          task,
        })),
        ...dayPlan.untimedReminders.map((reminder) => ({
          id: reminder.id,
          title: reminder.title,
          detail: 'Напоминание',
          kind: 'reminder' as const,
        })),
      ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerSurface}>
        <View style={[styles.headerContent, temporaryWebContentStyle()]}>
          <View>
            <Text style={styles.screenTitle}>План</Text>
            <Text style={styles.date}>{formatPlanDate(selectedDate)}</Text>
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
              onPress={() => {
                onRefresh?.();
                setFeedback('Данные плана обновлены');
              }}
              style={({ pressed }) => [styles.refreshControl, pressed && styles.pressed]}>
              <Ionicons color={designTokens.color.text.primary} name="refresh" size={18} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, temporaryWebContentStyle()]}>
        <SurfaceCard style={styles.hero} tone="info">
          <View style={styles.heroRow}>
            <ProgressRing label={`${formatPlanLoadPercent(loadPercent)}%`} value={Math.min(loadPercent, 100)} />
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{getPlanStatus(loadPercent)}</Text>
              <Text style={styles.heroDetail}>{dayPlan === null ? 'Загружаем план…' : `${formatPlanLoadPercent(loadPercent)}% загрузки`}</Text>
              <View style={styles.loadTrack}>
                <View style={[styles.loadValue, { width: `${Math.min(loadPercent, 100)}%` }]} />
              </View>
            </View>
          </View>
          <SurfaceCard style={styles.nextEvent}>
            <Text style={styles.nextDetail}>{scheduledItems.length === 0 ? 'Расписание свободно' : scheduledItems[0].detail}</Text>
            <Text style={styles.nextTitle}>{scheduledItems.length === 0 ? 'Нет блоков на этот день' : scheduledItems[0].title}</Text>
          </SurfaceCard>
        </SurfaceCard>

        <SectionHeader action={`${untimedItems.length} дел`} title="Без времени" />
        <View style={styles.list}>
          {untimedItems.length === 0 ? <EmptyPlanRow message="Нет задач и напоминаний без времени" /> : untimedItems.map((item) => (
            <PlanListRow item={item} key={item.id} onEditTask={onEditTask} />
          ))}
        </View>

        <SectionHeader action={`${scheduledItems.length} блоков`} title="Расписание" />
        <View style={styles.list}>
          {scheduledItems.length === 0 ? <EmptyPlanRow message="Нет временных блоков" /> : scheduledItems.map((item) => (
            <PlanListRow item={item} key={item.id} onEditTask={onEditTask} />
          ))}
        </View>

        {feedback === null ? null : <Text accessibilityLiveRegion="polite" style={styles.feedback}>{feedback}</Text>}
      </ScrollView>

      <Pressable
        accessibilityLabel="Добавить в план"
        accessibilityRole="button"
        onPress={() => {
          if (onCreateTask === undefined) {
            setFeedback('Добавление в план сейчас недоступно');
            return;
          }
          onCreateTask();
        }}
        style={({ pressed }) => [styles.floatingAction, pressed && styles.pressed]}>
        <Ionicons color={designTokens.color.text.inverse} name="add" size={28} />
      </Pressable>
    </SafeAreaView>
  );
}

function SectionHeader({ action, title }: { action: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionAction}>{action}</Text>
    </View>
  );
}

function EmptyPlanRow({ message }: { message: string }) {
  return (
    <SurfaceCard style={styles.emptyRow}>
      <Text style={styles.emptyText}>{message}</Text>
    </SurfaceCard>
  );
}

function PlanListRow({
  item,
  onEditTask,
}: {
  item: DayListItem;
  onEditTask?: (task: TaskItem, occurrence?: DayPlanOccurrence, block?: DayPlanBlock) => void;
}) {
  return (
    <SurfaceCard
      accessibilityLabel={item.task === undefined ? undefined : `Редактировать ${item.title}`}
      onPress={item.task === undefined || onEditTask === undefined
        ? undefined
        : () => onEditTask(item.task as TaskItem, item.occurrence, item.block)}
      style={styles.listRow}>
      <View style={[styles.dot, item.kind === 'reminder' && styles.reminderDot]} />
      <View style={styles.listCopy}>
        <Text numberOfLines={1} style={styles.listTitle}>{item.title}</Text>
        <Text numberOfLines={1} style={styles.listDetail}>{item.detail}</Text>
      </View>
    </SurfaceCard>
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
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: designTokens.space[4] },
  refreshControl: {
    alignItems: 'center', backgroundColor: designTokens.color.surface.subtle,
    borderRadius: designTokens.radius.pill, height: designTokens.size.touchTargetMin,
    justifyContent: 'center', width: designTokens.size.touchTargetMin,
  },
  scrollContent: {
    paddingBottom: designTokens.space[32] + designTokens.size.floatingAction + designTokens.space[24],
    paddingHorizontal: designTokens.space[16], paddingTop: designTokens.space[12],
  },
  hero: { padding: designTokens.space[12] },
  heroRow: { alignItems: 'center', flexDirection: 'row', gap: designTokens.space[12] },
  heroCopy: { flex: 1 },
  heroTitle: {
    color: designTokens.color.text.primary, fontSize: designTokens.typography.size.body,
    fontWeight: designTokens.typography.weight.bold, lineHeight: designTokens.typography.lineHeight.body,
  },
  heroDetail: {
    color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta, marginTop: designTokens.space[2],
  },
  loadTrack: {
    backgroundColor: designTokens.color.calendar.progressTrack, borderRadius: designTokens.radius.pill,
    height: designTokens.space[8], marginTop: designTokens.space[6], overflow: 'hidden',
  },
  loadValue: {
    backgroundColor: designTokens.color.feedback.warning.border, borderRadius: designTokens.radius.pill,
    height: '100%',
  },
  nextEvent: { marginTop: designTokens.space[10], padding: designTokens.space[10] },
  nextDetail: {
    color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  nextTitle: {
    color: designTokens.color.text.primary, fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold, lineHeight: designTokens.typography.lineHeight.label,
    marginTop: designTokens.space[2],
  },
  sectionHeader: {
    alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between',
    marginTop: designTokens.space[16], paddingHorizontal: designTokens.space[2],
  },
  sectionTitle: {
    color: designTokens.color.text.primary, fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold, lineHeight: designTokens.typography.lineHeight.label,
  },
  sectionAction: {
    color: designTokens.color.primary, fontSize: designTokens.typography.size.meta,
    fontWeight: designTokens.typography.weight.semibold, lineHeight: designTokens.typography.lineHeight.meta,
  },
  list: { gap: designTokens.space[6], marginTop: designTokens.space[6] },
  listRow: {
    alignItems: 'center', flexDirection: 'row', gap: designTokens.space[8], padding: designTokens.space[10],
  },
  emptyRow: { padding: designTokens.space[10] },
  emptyText: {
    color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  dot: {
    backgroundColor: designTokens.color.feedback.success.base, borderRadius: designTokens.radius.pill,
    height: designTokens.space[8], width: designTokens.space[8],
  },
  reminderDot: { backgroundColor: designTokens.color.meeting.accent },
  listCopy: { flex: 1 },
  listTitle: {
    color: designTokens.color.text.primary, fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.semibold, lineHeight: designTokens.typography.lineHeight.label,
  },
  listDetail: {
    color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta, marginTop: designTokens.space[2],
  },
  feedback: {
    color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta, marginTop: designTokens.space[12], textAlign: 'center',
  },
  floatingAction: {
    alignItems: 'center', backgroundColor: designTokens.color.primary, borderRadius: designTokens.radius.pill,
    bottom: designTokens.space[16], height: designTokens.size.floatingAction, justifyContent: 'center',
    position: 'absolute', right: designTokens.space[16], width: designTokens.size.floatingAction,
    ...designTokens.elevation.floatingAction,
  },
  pressed: { opacity: designTokens.state.pressedOpacity },
});
