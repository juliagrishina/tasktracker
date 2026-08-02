import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppServices } from '../../../../application/app-services-provider';
import type { BacklogItemKind } from '../../../../application/backlog-types';
import type { Project, Reminder, TaskItem } from '../../../../domain/entities';
import { ItemDetailActions } from '../../../../ui/backlog/item-detail-actions';
import { ItemFormSheet, type ItemFormType } from '../../../../ui/backlog/item-form-sheet';
import { ScreenShell } from '../../../../ui/screen-shell';

type BacklogDetailItem = Project | Reminder | TaskItem;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function findActiveItem(
  id: string | undefined,
  kind: BacklogItemKind | undefined,
  reminders: readonly Reminder[],
  taskItems: readonly TaskItem[],
): BacklogDetailItem | undefined {
  if (kind === 'reminder') {
    return reminders.find((item) => item.id === id);
  }

  return taskItems.find((item) => item.id === id && item.kind === kind);
}

function detailLines(item: BacklogDetailItem): readonly string[] {
  const lines: string[] = [];

  if ('description' in item && item.description !== null) {
    lines.push(item.description);
  }
  if ('estimatedDurationMinutes' in item && item.estimatedDurationMinutes !== null) {
    lines.push(`Оценочная длительность: ${item.estimatedDurationMinutes} мин.`);
  }
  if ('remindsOn' in item && item.remindsOn !== null) {
    lines.push(`Дата: ${item.remindsOn}`);
  }
  if ('periodStartOn' in item && item.periodStartOn !== null && item.periodEndOn !== null) {
    lines.push(`Период: ${item.periodStartOn} — ${item.periodEndOn}`);
  }
  if ('repeatRule' in item && item.repeatRule !== null) {
    lines.push(`Повтор: ${item.repeatRule.frequency}, каждые ${item.repeatRule.interval}`);
  }

  return lines;
}

export default function ItemRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; kind?: string | string[] }>();
  const { backlog } = useAppServices();
  const [editing, setEditing] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const kind = firstValue(params.kind) as BacklogItemKind | undefined;
  const taskItems = [
    ...backlog.unassignedTasks.flatMap(({ task, subtasks }) => [task, ...subtasks]),
    ...backlog.projects.flatMap(({ tasks }) => tasks.flatMap(({ task, subtasks }) => [task, ...subtasks])),
  ];
  const item = findActiveItem(firstValue(params.id), kind, backlog.reminders, taskItems);

  if (item === undefined || kind === undefined) {
    return (
      <ScreenShell onBack={() => router.back()} title="Элемент">
        <Text style={styles.empty}>Элемент больше не находится в активном Backlog.</Text>
      </ScreenShell>
    );
  }

  const formType = kind as ItemFormType;

  return (
    <ScreenShell onBack={() => router.back()} title={item.title}>
      <View style={styles.details}>
        {detailLines(item).length === 0 ? <Text style={styles.muted}>Дополнительных деталей пока нет.</Text> : null}
        {detailLines(item).map((line) => <Text key={line} style={styles.line}>{line}</Text>)}
      </View>
      <ItemDetailActions
        id={item.id}
        kind={kind}
        onAddSubtask={kind === 'task' ? () => setAddingSubtask(true) : undefined}
        onCompleted={() => router.back()}
        onDeleted={() => router.back()}
        onEdit={() => setEditing(true)}
      />
      {editing ? (
        <ItemFormSheet
          item={item}
          mode="edit"
          onClose={() => setEditing(false)}
          type={formType}
          visible
        />
      ) : null}
      {kind !== 'task' ? null : (
        addingSubtask ? (
          <ItemFormSheet
            mode="create"
            onClose={() => setAddingSubtask(false)}
            parentTaskId={item.id}
            type="subtask"
            visible
          />
        ) : null
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  details: { gap: 10, borderRadius: 16, backgroundColor: '#FFFFFF', padding: 17 },
  line: { color: '#475467', fontSize: 16, lineHeight: 23 },
  muted: { color: '#98A2B3', fontSize: 16 },
  empty: { color: '#667085', fontSize: 16, lineHeight: 23 },
});
