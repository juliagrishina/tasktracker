import { migrateLegacyEntityIds } from '../../src/data/legacy-id-migration';
import { isUuid } from '../../src/domain/uuid';

describe('legacy identifier migration', () => {
  test('replaces legacy IDs and preserves relations between all persisted planning entities', () => {
    const migrated = migrateLegacyEntityIds({
      projects: [{ id: 'project-1', title: 'Проект', description: null, completedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null }],
      taskItems: [{ id: 'task-1', kind: 'task' as const, projectId: 'project-1', parentTaskId: null, title: 'Задача', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null }],
      reminders: [{ id: 'reminder-1', title: 'Напоминание', linkedTaskItemId: 'task-1', linkedOccurrenceOn: null, remindsOn: null, periodStartOn: null, periodEndOn: null, repeatRule: null, estimatedDurationMinutes: null, completedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null }],
      scheduleBlocks: [{ id: 'block-1', taskItemId: 'task-1', occurrenceId: 'occurrence-1', timeZoneId: 'Europe/Moscow', startsAt: '2026-01-01T09:00:00.000Z', endsAt: '2026-01-01T10:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null }],
      recurrenceSeries: [{ id: 'series-1', itemKind: 'task' as const, itemId: 'task-1', frequency: 'daily' as const, interval: 1, startsOn: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null }],
      recurrenceOccurrences: [{ id: 'occurrence-1', seriesId: 'series-1', occursOn: '2026-01-01', cancelledAt: null, completedAt: null, blocksOverridden: false, taskPatch: { projectId: 'project-1' }, reminderPatch: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null }],
      recurrenceRevisions: [{ id: 'revision-1', seriesId: 'series-1', effectiveFrom: '2026-01-01', frequency: 'daily' as const, interval: 1, taskPatch: { projectId: 'project-1' }, blockTemplates: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null }],
      transferHistories: [{ id: 'history-1', taskItemId: 'task-1', reason: null, returnedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' }],
      syncState: { deviceId: 'device-1', dataGeneration: 1 },
      syncEntityVersions: [['task_items:task-1', 2]],
      syncOutbox: [{ mutationId: 'mutation-1', deviceId: 'device-1', entityType: 'task_items', entityId: 'task-1', operation: 'upsert' as const, expectedVersion: 1, dataGeneration: 1, payload: { id: 'task-1', projectId: 'project-1' }, createdAt: '2026-01-01T00:00:00.000Z' }],
    });

    const project = migrated.projects[0];
    const task = migrated.taskItems[0];
    const series = migrated.recurrenceSeries[0];
    const occurrence = migrated.recurrenceOccurrences[0];

    const identifiers = [project.id, task.id, migrated.reminders[0].id, migrated.scheduleBlocks[0].id, series.id, occurrence.id, migrated.recurrenceRevisions[0].id, migrated.transferHistories[0].id];
    expect(identifiers.every(isUuid)).toBe(true);
    expect(task.projectId).toBe(project.id);
    expect(migrated.reminders[0].linkedTaskItemId).toBe(task.id);
    expect(series.itemId).toBe(task.id);
    expect(occurrence.seriesId).toBe(series.id);
    expect(migrated.scheduleBlocks[0]).toMatchObject({ taskItemId: task.id, occurrenceId: occurrence.id });
    expect(occurrence.taskPatch).toMatchObject({ projectId: project.id });
    expect(migrated.recurrenceRevisions[0]).toMatchObject({ seriesId: series.id, taskPatch: { projectId: project.id } });
    expect(migrated.transferHistories[0].taskItemId).toBe(task.id);
    expect(isUuid(migrated.syncState?.deviceId ?? '')).toBe(true);
    expect(migrated.syncEntityVersions).toEqual([[`task_items:${task.id}`, 2]]);
    expect(migrated.syncOutbox[0]).toMatchObject({ entityId: task.id, deviceId: migrated.syncState?.deviceId, payload: { id: task.id, projectId: project.id } });
  });
});
