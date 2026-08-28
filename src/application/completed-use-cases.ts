import type { AppDataSource } from '../data/contracts';
import type { EntityId } from '../domain/entities';

export type CompletedItemKind = 'project' | 'reminder' | 'task' | 'subtask';

export interface CompletedItem {
  id: EntityId;
  kind: CompletedItemKind;
  title: string;
  completedAt: string;
  occurrence: { seriesId: EntityId; occursOn: string } | null;
  taskId?: EntityId;
}

export async function getCompletedItems(source: AppDataSource): Promise<readonly CompletedItem[]> {
  const [projects, reminders, tasks, series] = await Promise.all([
    source.listProjects(),
    source.listReminders(),
    source.listTaskItems(),
    source.listRecurrenceSeries(),
  ]);
  const result: CompletedItem[] = [
    ...projects.filter((item) => item.completedAt !== null).map((item) => ({ id: item.id, kind: 'project' as const, title: item.title, completedAt: item.completedAt!, occurrence: null })),
    ...reminders.filter((item) => item.completedAt !== null).map((item) => ({ id: item.id, kind: 'reminder' as const, title: item.title, completedAt: item.completedAt!, occurrence: null })),
    ...tasks.filter((item) => item.completedAt !== null).map((item) => ({ id: item.id, kind: item.kind, title: item.title, completedAt: item.completedAt!, occurrence: null })),
  ];
  for (const recurrence of series.filter((item) => item.itemKind === 'task')) {
    const task = tasks.find((item) => item.id === recurrence.itemId);
    if (task === undefined) continue;
    for (const occurrence of await source.listRecurrenceOccurrences(recurrence.id)) {
      if (occurrence.completedAt === null) continue;
      result.push({
        id: `recurrence:${recurrence.id}:${occurrence.occursOn}`,
        kind: task.kind,
        title: occurrence.taskPatch?.title ?? task.title,
        completedAt: occurrence.completedAt,
        occurrence: { seriesId: recurrence.id, occursOn: occurrence.occursOn },
        taskId: recurrence.itemId,
      });
    }
  }
  return result.sort((left, right) => right.completedAt.localeCompare(left.completedAt) || left.title.localeCompare(right.title, 'ru'));
}
