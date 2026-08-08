import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BacklogItemKind, BacklogTaskTree } from '../../application/backlog-types';
import { designTokens } from '../design/tokens';
import { SurfaceCard } from '../primitives/surface-card';

interface TreeListProps {
  trees: readonly BacklogTaskTree[];
  emptyText: string;
  onOpenItem: (id: string, kind: Extract<BacklogItemKind, 'task' | 'subtask'>) => void;
}

function durationText(minutes: number | null): string | null {
  return minutes === null ? null : `≈ ${minutes} мин.`;
}

export function TreeList({ trees, emptyText, onOpenItem }: TreeListProps) {
  if (trees.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }

  return (
    <View style={styles.list}>
      {trees.map(({ task, subtasks }) => (
        <SurfaceCard key={task.id} style={styles.card}>
          <Pressable onPress={() => onOpenItem(task.id, 'task')} style={styles.taskRow}>
            <View style={styles.checkCircle} />
            <View style={styles.textColumn}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              {durationText(task.estimatedDurationMinutes) === null ? null : (
                <Text style={styles.detail}>{durationText(task.estimatedDurationMinutes)}</Text>
              )}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          {subtasks.map((subtask) => (
            <Pressable
              key={subtask.id}
              onPress={() => onOpenItem(subtask.id, 'subtask')}
              style={styles.subtaskRow}>
              <View style={styles.subtaskCheckCircle} />
              <View style={styles.textColumn}>
                <Text style={styles.subtaskTitle}>{subtask.title}</Text>
                {durationText(subtask.estimatedDurationMinutes) === null ? null : (
                  <Text style={styles.detail}>{durationText(subtask.estimatedDurationMinutes)}</Text>
                )}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </SurfaceCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: designTokens.space[10] },
  card: { overflow: 'hidden', padding: 0 },
  taskRow: {
    minHeight: designTokens.size.touchTargetMin,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: designTokens.space[12],
    paddingVertical: designTokens.space[8],
  },
  subtaskRow: {
    minHeight: designTokens.size.touchTargetMin,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: designTokens.space[24],
    borderTopWidth: 1,
    borderTopColor: designTokens.color.border.subtle,
    paddingHorizontal: designTokens.space[12],
    paddingVertical: designTokens.space[8],
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: designTokens.color.text.tertiary,
    borderRadius: designTokens.radius.pill,
    marginRight: designTokens.space[10],
  },
  subtaskCheckCircle: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: designTokens.color.text.tertiary,
    borderRadius: designTokens.radius.pill,
    marginRight: designTokens.space[10],
  },
  textColumn: { flex: 1 },
  taskTitle: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
    fontWeight: designTokens.typography.weight.bold,
  },
  subtaskTitle: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
    fontWeight: designTokens.typography.weight.semibold,
  },
  detail: {
    marginTop: designTokens.space[2],
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  chevron: {
    marginLeft: designTokens.space[8],
    color: designTokens.color.text.tertiary,
    fontSize: designTokens.typography.size.sectionTitle,
  },
  empty: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
});
