import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ScheduleBlock } from '../../domain/entities';
import { getDateInTimeZone, getTimeInTimeZone } from '../../domain/planning';
import { designTokens } from '../design/tokens';

import { getDayTimelineBlockLayouts } from './day-timeline-model';

const HOUR_HEIGHT = 64;
const MINUTE_HEIGHT = HOUR_HEIGHT / 60;
const TIMELINE_GUTTER = 52;
const WORKDAY_START_HOUR = 8;
const WORKDAY_END_HOUR = 22;

interface DayTimelineProps {
  blocks: readonly ScheduleBlock[];
  completedBlockIds?: ReadonlySet<string>;
  now?: Date;
  onPressBlock?: (block: ScheduleBlock) => void;
  onLongPressBlock?: (block: ScheduleBlock) => void;
  selectedDate: string;
  timeZoneId: string;
  titleByTaskId: ReadonlyMap<string, string>;
}

function toMinute(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function getCurrentMinute(selectedDate: string, timeZoneId: string, now: Date): number | null {
  if (getDateInTimeZone(now.toISOString(), timeZoneId) !== selectedDate) return null;
  return toMinute(getTimeInTimeZone(now.toISOString(), timeZoneId));
}

function formatTimeRange(block: ScheduleBlock, timeZoneId: string): string {
  return `${getTimeInTimeZone(block.startsAt, timeZoneId)}–${getTimeInTimeZone(block.endsAt, timeZoneId)}`;
}

export function DayTimeline({ blocks, completedBlockIds = new Set(), now = new Date(), onLongPressBlock, onPressBlock, selectedDate, timeZoneId, titleByTaskId }: DayTimelineProps) {
  const scrollRef = useRef<ScrollView>(null);
  const layouts = getDayTimelineBlockLayouts(blocks, selectedDate, timeZoneId);
  const currentMinute = getCurrentMinute(selectedDate, timeZoneId, now);
  const initialMinute = Math.max(WORKDAY_START_HOUR * 60, (currentMinute ?? WORKDAY_START_HOUR * 60) - 60);

  useEffect(() => {
    scrollRef.current?.scrollTo({ animated: false, y: Math.max(0, initialMinute * MINUTE_HEIGHT - HOUR_HEIGHT) });
  }, [initialMinute]);

  return (
    <ScrollView
      accessibilityLabel="Суточная шкала: 24 часа"
      nestedScrollEnabled
      ref={scrollRef}
      showsVerticalScrollIndicator
      style={styles.scrollView}>
      <View style={styles.timeline}>
        {Array.from({ length: 24 }, (_, hour) => (
          <View key={hour} pointerEvents="none" style={[styles.hour, { top: hour * HOUR_HEIGHT }, hour >= WORKDAY_START_HOUR && hour < WORKDAY_END_HOUR ? styles.workHour : styles.offHour]}>
            <Text style={styles.hourLabel}>{String(hour).padStart(2, '0')}:00</Text>
          </View>
        ))}
        <View pointerEvents="box-none" style={styles.blocksLayer}>
          {layouts.map((layout) => {
            const title = titleByTaskId.get(layout.block.taskItemId) ?? 'Задача';
            const timeRange = formatTimeRange(layout.block, timeZoneId);
            const isCompleted = completedBlockIds.has(layout.blockId);
            const label = `${title}, ${timeRange}${isCompleted ? ', выполнено' : ''}, колонка ${layout.column + 1} из ${layout.columnCount}`;
            return (
              <Pressable
                accessibilityLabel={label}
                accessibilityRole="button"
                disabled={isCompleted}
                key={layout.blockId}
                onLongPress={() => onLongPressBlock?.(layout.block)}
                onPress={() => onPressBlock?.(layout.block)}
                style={({ pressed }) => [
                  styles.block,
                  {
                    height: Math.max(36, layout.durationMinutes * MINUTE_HEIGHT),
                    left: `${layout.column / layout.columnCount * 100}%`,
                    top: layout.startMinute * MINUTE_HEIGHT,
                    width: `${1 / layout.columnCount * 100}%`,
                  },
                  isCompleted && styles.completedBlock,
                  pressed && styles.pressed,
                ]}>
                <Text numberOfLines={1} style={[styles.blockTitle, isCompleted && styles.completedText]}>{isCompleted ? `✓ ${title}` : title}</Text>
                <Text numberOfLines={1} style={[styles.blockTime, isCompleted && styles.completedText]}>{timeRange}</Text>
              </Pressable>
            );
          })}
        </View>
        {currentMinute === null ? null : (
          <View accessibilityLabel={`Текущее время ${getTimeInTimeZone(now.toISOString(), timeZoneId)}`} style={[styles.currentTime, { top: currentMinute * MINUTE_HEIGHT }]}>
            <Text style={styles.currentTimeLabel}>{getTimeInTimeZone(now.toISOString(), timeZoneId)}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    height: HOUR_HEIGHT * 7,
    marginTop: designTokens.space[6],
  },
  timeline: {
    height: HOUR_HEIGHT * 24,
    position: 'relative',
  },
  hour: {
    borderTopColor: designTokens.color.border.subtle,
    borderTopWidth: 1,
    height: HOUR_HEIGHT,
    left: 0,
    paddingLeft: designTokens.space[2],
    paddingTop: designTokens.space[2],
    position: 'absolute',
    right: 0,
  },
  workHour: {
    backgroundColor: designTokens.color.surface.raised,
  },
  offHour: {
    backgroundColor: designTokens.color.surface.subtle,
  },
  hourLabel: {
    color: designTokens.color.text.tertiary,
    fontSize: designTokens.typography.size.micro,
    lineHeight: designTokens.typography.lineHeight.micro,
  },
  blocksLayer: {
    bottom: 0,
    left: TIMELINE_GUTTER,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  block: {
    backgroundColor: designTokens.color.primarySoft,
    borderColor: designTokens.color.border.info,
    borderLeftColor: designTokens.color.primary,
    borderLeftWidth: designTokens.space[4],
    borderRadius: designTokens.radius.compact,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: designTokens.space[6],
    paddingVertical: designTokens.space[4],
    position: 'absolute',
  },
  completedBlock: {
    backgroundColor: designTokens.color.surface.subtle,
    borderColor: designTokens.color.border.subtle,
    borderLeftColor: designTokens.color.border.subtle,
  },
  blockTitle: {
    color: designTokens.color.primaryStrong,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  blockTime: {
    color: designTokens.color.primaryStrong,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  completedText: {
    color: designTokens.color.text.tertiary,
    textDecorationLine: 'line-through',
  },
  currentTime: {
    alignItems: 'center',
    backgroundColor: designTokens.color.feedback.danger.foreground,
    flexDirection: 'row',
    height: 2,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  currentTimeLabel: {
    backgroundColor: designTokens.color.feedback.danger.foreground,
    borderRadius: designTokens.radius.pill,
    color: designTokens.color.text.inverse,
    fontSize: designTokens.typography.size.micro,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.micro,
    marginLeft: designTokens.space[2],
    paddingHorizontal: designTokens.space[6],
    paddingVertical: designTokens.space[2],
  },
  pressed: {
    opacity: designTokens.state.pressedOpacity,
  },
});
