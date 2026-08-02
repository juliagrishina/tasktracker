import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BacklogItemKind, BacklogTaskTree } from '../../application/backlog-types';

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
        <View key={task.id} style={styles.card}>
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
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { overflow: 'hidden', borderRadius: 16, backgroundColor: '#FFFFFF', shadowColor: '#101828', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  taskRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  subtaskRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', marginLeft: 32, borderTopWidth: 1, borderTopColor: '#F2F4F7', paddingHorizontal: 16 },
  checkCircle: { width: 22, height: 22, borderWidth: 2, borderColor: '#98A2B3', borderRadius: 11, marginRight: 12 },
  subtaskCheckCircle: { width: 18, height: 18, borderWidth: 2, borderColor: '#C0C7D4', borderRadius: 9, marginRight: 11 },
  textColumn: { flex: 1 },
  taskTitle: { color: '#172033', fontSize: 16, fontWeight: '700' },
  subtaskTitle: { color: '#344054', fontSize: 15, fontWeight: '600' },
  detail: { marginTop: 3, color: '#667085', fontSize: 13 },
  chevron: { marginLeft: 10, color: '#98A2B3', fontSize: 25 },
  empty: { color: '#667085', fontSize: 16, lineHeight: 23 },
});
