import type {
  Project,
  RecurrenceOccurrence,
  RecurrenceRevision,
  RecurrenceSeries,
  Reminder,
  ScheduleBlock,
  TaskItem,
  TransferHistory,
} from '../domain/entities';
import { isUuid, stableLegacyUuid } from '../domain/uuid';

import type { SyncEntityType, SyncOutboxMutation } from './sync-outbox';

export interface LegacyIdCollections {
  projects: readonly Project[];
  taskItems: readonly TaskItem[];
  reminders: readonly Reminder[];
  scheduleBlocks: readonly ScheduleBlock[];
  recurrenceSeries: readonly RecurrenceSeries[];
  recurrenceOccurrences: readonly RecurrenceOccurrence[];
  recurrenceRevisions: readonly RecurrenceRevision[];
  transferHistories: readonly TransferHistory[];
  syncState?: { deviceId: string; dataGeneration: number } | null;
  syncEntityVersions?: readonly [string, number][];
  syncOutbox?: readonly SyncOutboxMutation[];
}

type PersistedEntityType = Exclude<SyncEntityType, 'daily_energy_entries' | 'user_settings'>;

const entityTypes = new Set<PersistedEntityType>([
  'projects', 'task_items', 'reminders', 'schedule_blocks',
  'recurrence_series', 'recurrence_occurrences', 'recurrence_revisions', 'transfer_history',
]);

export function migrateLegacyEntityIds<T extends LegacyIdCollections>(snapshot: T): T {
  const mapId = (entityType: string, id: string): string =>
    entityTypes.has(entityType as PersistedEntityType) && !isUuid(id)
      ? stableLegacyUuid(entityType, id)
      : id;
  const mapTaskId = (id: string | null): string | null => id === null ? null : mapId('task_items', id);
  const mapProjectPatch = <TTaskPatch extends { projectId?: string | null } | null | undefined>(patch: TTaskPatch): TTaskPatch =>
    patch === null || patch === undefined || patch.projectId === undefined
      ? patch
      : { ...patch, projectId: mapProjectId(patch.projectId) } as TTaskPatch;
  const mapProjectId = (id: string | null): string | null => id === null ? null : mapId('projects', id);

  const projects = snapshot.projects.map((project) => ({ ...project, id: mapId('projects', project.id) }));
  const taskItems = snapshot.taskItems.map((task) => ({
    ...task,
    id: mapId('task_items', task.id),
    projectId: mapProjectId(task.projectId),
    parentTaskId: mapTaskId(task.parentTaskId),
  })) as TaskItem[];
  const reminders = snapshot.reminders.map((reminder) => ({
    ...reminder,
    id: mapId('reminders', reminder.id),
    linkedTaskItemId: reminder.linkedTaskItemId === undefined
      ? undefined
      : mapTaskId(reminder.linkedTaskItemId),
  }));
  const recurrenceSeries = snapshot.recurrenceSeries.map((series) => ({
    ...series,
    id: mapId('recurrence_series', series.id),
    itemId: mapId(series.itemKind === 'task' ? 'task_items' : 'reminders', series.itemId),
  }));
  const recurrenceOccurrences = snapshot.recurrenceOccurrences.map((occurrence) => ({
    ...occurrence,
    id: mapId('recurrence_occurrences', occurrence.id),
    seriesId: mapId('recurrence_series', occurrence.seriesId),
    taskPatch: mapProjectPatch(occurrence.taskPatch),
  }));
  const recurrenceRevisions = snapshot.recurrenceRevisions.map((revision) => ({
    ...revision,
    id: mapId('recurrence_revisions', revision.id),
    seriesId: mapId('recurrence_series', revision.seriesId),
    taskPatch: mapProjectPatch(revision.taskPatch),
  }));
  const scheduleBlocks = snapshot.scheduleBlocks.map((block) => ({
    ...block,
    id: mapId('schedule_blocks', block.id),
    taskItemId: mapId('task_items', block.taskItemId),
    occurrenceId: block.occurrenceId === null || block.occurrenceId.startsWith('virtual:')
      ? block.occurrenceId
      : mapId('recurrence_occurrences', block.occurrenceId),
    displayTaskPatch: mapProjectPatch(block.displayTaskPatch),
  }));
  const transferHistories = snapshot.transferHistories.map((history) => ({
    ...history,
    id: mapId('transfer_history', history.id),
    taskItemId: mapId('task_items', history.taskItemId),
  }));
  const syncState = snapshot.syncState === undefined || snapshot.syncState === null
    ? snapshot.syncState
    : { ...snapshot.syncState, deviceId: isUuid(snapshot.syncState.deviceId) ? snapshot.syncState.deviceId : stableLegacyUuid('sync_devices', snapshot.syncState.deviceId) };
  const syncEntityVersions = snapshot.syncEntityVersions?.map(([key, version]) => {
    const separator = key.indexOf(':');
    if (separator < 0) return [key, version] as [string, number];
    const entityType = key.slice(0, separator);
    return [`${entityType}:${mapId(entityType, key.slice(separator + 1))}`, version] as [string, number];
  });
  const syncOutbox = snapshot.syncOutbox?.map((mutation) => ({
    ...mutation,
    mutationId: isUuid(mutation.mutationId) ? mutation.mutationId : stableLegacyUuid('sync_mutations', mutation.mutationId),
    deviceId: isUuid(mutation.deviceId) ? mutation.deviceId : stableLegacyUuid('sync_devices', mutation.deviceId),
    entityId: mapId(mutation.entityType, mutation.entityId),
    payload: mapSyncPayload(mutation.entityType, mutation.payload, mapId),
  }));

  return {
    ...snapshot,
    projects,
    taskItems,
    reminders,
    scheduleBlocks,
    recurrenceSeries,
    recurrenceOccurrences,
    recurrenceRevisions,
    transferHistories,
    ...(syncState === undefined ? {} : { syncState }),
    ...(syncEntityVersions === undefined ? {} : { syncEntityVersions }),
    ...(syncOutbox === undefined ? {} : { syncOutbox }),
  };
}

function mapSyncPayload(
  entityType: SyncEntityType,
  payload: unknown,
  mapId: (entityType: string, id: string) => string,
): unknown {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const value = { ...(payload as Record<string, unknown>) };
  if (typeof value.id === 'string') value.id = mapId(entityType, value.id);
  if (typeof value.projectId === 'string') value.projectId = mapId('projects', value.projectId);
  if (typeof value.parentTaskId === 'string') value.parentTaskId = mapId('task_items', value.parentTaskId);
  if (typeof value.linkedTaskItemId === 'string') value.linkedTaskItemId = mapId('task_items', value.linkedTaskItemId);
  if (typeof value.taskItemId === 'string') value.taskItemId = mapId('task_items', value.taskItemId);
  if (typeof value.seriesId === 'string') value.seriesId = mapId('recurrence_series', value.seriesId);
  if (typeof value.occurrenceId === 'string' && !value.occurrenceId.startsWith('virtual:')) value.occurrenceId = mapId('recurrence_occurrences', value.occurrenceId);
  if (entityType === 'recurrence_series' && typeof value.itemId === 'string') {
    value.itemId = mapId(value.itemKind === 'reminder' ? 'reminders' : 'task_items', value.itemId);
  }
  if (value.taskPatch !== null && typeof value.taskPatch === 'object' && !Array.isArray(value.taskPatch)) {
    value.taskPatch = mapSyncPayload('task_items', value.taskPatch, mapId);
  }
  return value;
}
