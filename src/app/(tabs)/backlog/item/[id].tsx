import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useAppServices } from '../../../../application/app-services-provider';
import type { BacklogItemKind } from '../../../../application/backlog-types';
import type { TaskPlanningSnapshot } from '../../../../application/planning-use-cases';
import type { Project, Reminder, TaskItem } from '../../../../domain/entities';
import { ItemDetailActions } from '../../../../ui/backlog/item-detail-actions';
import { ItemFormSheet, type ItemFormType } from '../../../../ui/backlog/item-form-sheet';
import {
  createInitialTaskPlanningDraft,
  type TaskPlanningDraft,
} from '../../../../ui/backlog/task-planning-fields';
import { designTokens } from '../../../../ui/design/tokens';
import { SurfaceCard } from '../../../../ui/primitives/surface-card';
import { ScreenShell } from '../../../../ui/screen-shell';

type BacklogDetailItem = Project | Reminder | TaskItem;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getLocalIsoDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createPlanningDraft(task: TaskItem, snapshot: TaskPlanningSnapshot): TaskPlanningDraft {
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
  const { backlog, planningActions } = useAppServices();
  const [editing, setEditing] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [planningSnapshot, setPlanningSnapshot] = useState<TaskPlanningSnapshot | null>(null);
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
  const openEditor = async () => {
    if (kind === 'task' || kind === 'subtask') {
      setPlanningSnapshot(await planningActions.getTaskPlanningSnapshot(item.id));
    }
    setEditing(true);
  };
  const closeEditor = () => {
    setEditing(false);
    setPlanningSnapshot(null);
  };

  return (
    <ScreenShell onBack={() => router.back()} title={item.title}>
      <SurfaceCard style={styles.details}>
        {detailLines(item).length === 0 ? <Text style={styles.muted}>Дополнительных деталей пока нет.</Text> : null}
        {detailLines(item).map((line) => <Text key={line} style={styles.line}>{line}</Text>)}
      </SurfaceCard>
      <ItemDetailActions
        id={item.id}
        kind={kind}
        onAddSubtask={kind === 'task' ? () => setAddingSubtask(true) : undefined}
        onCompleted={() => router.back()}
        onDeleted={() => router.back()}
        onEdit={() => void openEditor()}
      />
      {editing ? (
        <ItemFormSheet
          item={item}
          mode="edit"
          onClose={closeEditor}
          planningContext={{
            defaultDate: getLocalIsoDate(),
            ...(kind === 'task' || kind === 'subtask'
              ? {
                  initialBlockIds: planningSnapshot?.blocks.map((block) => block.id) ?? [],
                  initialDraft: planningSnapshot === null
                    ? createInitialTaskPlanningDraft()
                    : createPlanningDraft(item as TaskItem, planningSnapshot),
                }
              : {}),
          }}
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
            planningContext={{ defaultDate: getLocalIsoDate() }}
            type="subtask"
            visible
          />
        ) : null
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  details: { gap: designTokens.space[10], padding: designTokens.space[16] },
  line: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
  muted: {
    color: designTokens.color.text.tertiary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
  empty: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
});
