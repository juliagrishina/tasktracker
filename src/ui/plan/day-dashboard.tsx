import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { designTokens } from '../design/tokens';
import { SurfaceCard } from '../primitives/surface-card';
import { temporaryWebContentStyle } from '../screen-shell';

import { planDemoModel, type PlanDemoListItem } from './plan-demo-model';
import { ProgressRing } from './progress-ring';
import { getPlanViewModeLabel, PlanViewControl } from './plan-view-menu';
import type { PlanViewMode } from './plan-period-model';

interface DayDashboardProps {
  mode?: PlanViewMode;
  onCreateTask?: () => void;
  onSelectMode?: () => void;
  selectedDate?: string;
}

export function DayDashboard({ mode = 'day', onCreateTask, onSelectMode }: DayDashboardProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerSurface}>
        <View style={[styles.headerContent, temporaryWebContentStyle()]}>
          <View>
            <Text style={styles.screenTitle}>Сегодня</Text>
            <Text style={styles.date}>{planDemoModel.date}</Text>
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
              onPress={() => setFeedback('Данные плана обновлены')}
              style={({ pressed }) => [styles.refreshControl, pressed && styles.pressed]}>
              <Ionicons color={designTokens.color.text.primary} name="refresh" size={18} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, temporaryWebContentStyle()]}>
        <SurfaceCard style={styles.hero} tone="info">
          <View style={styles.heroRow}>
            <ProgressRing label={`${planDemoModel.completion}%`} value={planDemoModel.completion} />
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>План в норме</Text>
              <Text style={styles.heroDetail}>{planDemoModel.planned} · {planDemoModel.energy}</Text>
              <View style={styles.loadTrack}>
                <View style={styles.loadValue} />
              </View>
            </View>
          </View>
          <SurfaceCard style={styles.nextEvent}>
            <Text style={styles.nextDetail}>{planDemoModel.nextEvent.detail}</Text>
            <Text style={styles.nextTitle}>{planDemoModel.nextEvent.title}</Text>
          </SurfaceCard>
        </SurfaceCard>

        <SectionHeader action="2 дела" title="Без времени" />
        <View style={styles.list}>
          {planDemoModel.untimed.map((item) => (
            <PlanListRow item={item} key={item.title} />
          ))}
        </View>

        <SectionHeader action="Открыть день" title="Расписание" />
        <View style={styles.list}>
          {planDemoModel.schedule.map((item) => (
            <PlanListRow item={item} key={item.title} time={item.time} />
          ))}
        </View>

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

function PlanListRow({ item, time }: { item: PlanDemoListItem; time?: string }) {
  return (
    <SurfaceCard style={styles.listRow}>
      {time === undefined ? null : <Text style={styles.time}>{time}</Text>}
      <View style={[styles.dot, item.tone === 'meeting' && styles.meetingDot]} />
      <View style={styles.listCopy}>
        <Text numberOfLines={1} style={styles.listTitle}>{item.title}</Text>
        <Text numberOfLines={1} style={styles.listDetail}>{item.detail}</Text>
      </View>
    </SurfaceCard>
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
  listRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: designTokens.space[8],
    padding: designTokens.space[10],
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
