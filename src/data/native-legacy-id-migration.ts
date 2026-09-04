import type { SQLiteDatabase } from 'expo-sqlite';

import { isUuid, stableLegacyUuid } from '../domain/uuid';

import type { SyncEntityType } from './sync-outbox';

type IdentifierRow = { id: string };

/** Upgrades legacy string IDs before an account's first cloud synchronization. */
export async function migrateLegacyIdsInNativeDatabase(database: SQLiteDatabase): Promise<void> {
  const rows = await Promise.all([
    database.getAllAsync<IdentifierRow>('SELECT id FROM projects'),
    database.getAllAsync<IdentifierRow>('SELECT id FROM task_items'),
    database.getAllAsync<IdentifierRow>('SELECT id FROM reminders'),
    database.getAllAsync<IdentifierRow>('SELECT id FROM schedule_blocks'),
    database.getAllAsync<IdentifierRow>('SELECT id FROM recurrence_series'),
    database.getAllAsync<IdentifierRow>('SELECT id FROM recurrence_occurrences'),
    database.getAllAsync<IdentifierRow>('SELECT id FROM recurrence_revisions'),
    database.getAllAsync<IdentifierRow>('SELECT id FROM transfer_history'),
  ]);
  if (rows.every((table) => table.every((row) => isUuid(row.id)))) {
    await migrateNativeSyncMetadata(database);
    return;
  }

  const mapId = (entityType: string, id: string): string => isUuid(id) ? id : stableLegacyUuid(entityType, id);
  await database.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await database.withTransactionAsync(async () => {
      await replacePrimaryKeys(database, 'projects', 'projects');
      await replacePrimaryKeys(database, 'task_items', 'task_items');
      await replaceColumnValues(database, 'task_items', 'project_id', 'projects', mapId);
      await replaceColumnValues(database, 'task_items', 'parent_task_id', 'task_items', mapId);

      await replacePrimaryKeys(database, 'reminders', 'reminders');
      await replaceColumnValues(database, 'reminders', 'linked_task_item_id', 'task_items', mapId);

      await replacePrimaryKeys(database, 'recurrence_series', 'recurrence_series');
      const series = await database.getAllAsync<{ id: string; item_kind: 'task' | 'reminder'; item_id: string }>(
        'SELECT id, item_kind, item_id FROM recurrence_series',
      );
      for (const row of series) {
        const nextId = mapId(row.item_kind === 'task' ? 'task_items' : 'reminders', row.item_id);
        if (nextId !== row.item_id) await database.runAsync('UPDATE recurrence_series SET item_id = ? WHERE id = ?', [nextId, row.id]);
      }

      await replacePrimaryKeys(database, 'recurrence_occurrences', 'recurrence_occurrences');
      await replaceColumnValues(database, 'recurrence_occurrences', 'series_id', 'recurrence_series', mapId);
      await replaceProjectIdInJsonColumn(database, 'recurrence_occurrences', 'task_patch', mapId);

      await replacePrimaryKeys(database, 'recurrence_revisions', 'recurrence_revisions');
      await replaceColumnValues(database, 'recurrence_revisions', 'series_id', 'recurrence_series', mapId);
      await replaceProjectIdInJsonColumn(database, 'recurrence_revisions', 'task_patch_json', mapId);

      await replacePrimaryKeys(database, 'schedule_blocks', 'schedule_blocks');
      await replaceColumnValues(database, 'schedule_blocks', 'task_item_id', 'task_items', mapId);
      await replaceColumnValues(database, 'schedule_blocks', 'occurrence_id', 'recurrence_occurrences', mapId, true);

      await replacePrimaryKeys(database, 'transfer_history', 'transfer_history');
      await replaceColumnValues(database, 'transfer_history', 'task_item_id', 'task_items', mapId);
      await migrateNativeSyncMetadata(database, mapId);
    });
  } finally {
    await database.execAsync('PRAGMA foreign_keys = ON;');
  }
}

async function replacePrimaryKeys(database: SQLiteDatabase, table: string, entityType: string): Promise<void> {
  const rows = await database.getAllAsync<IdentifierRow>(`SELECT id FROM ${table}`);
  for (const row of rows) {
    const nextId = isUuid(row.id) ? row.id : stableLegacyUuid(entityType, row.id);
    if (nextId !== row.id) await database.runAsync(`UPDATE ${table} SET id = ? WHERE id = ?`, [nextId, row.id]);
  }
}

async function replaceColumnValues(
  database: SQLiteDatabase,
  table: string,
  column: string,
  entityType: string,
  mapId: (entityType: string, id: string) => string,
  preservesVirtualOccurrence = false,
): Promise<void> {
  const rows = await database.getAllAsync<{ id: string; value: string | null }>(`SELECT id, ${column} AS value FROM ${table}`);
  for (const row of rows) {
    if (row.value === null || (preservesVirtualOccurrence && row.value.startsWith('virtual:'))) continue;
    const nextId = mapId(entityType, row.value);
    if (nextId !== row.value) await database.runAsync(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, [nextId, row.id]);
  }
}

async function replaceProjectIdInJsonColumn(
  database: SQLiteDatabase,
  table: string,
  column: string,
  mapId: (entityType: string, id: string) => string,
): Promise<void> {
  const rows = await database.getAllAsync<{ id: string; value: string | null }>(`SELECT id, ${column} AS value FROM ${table}`);
  for (const row of rows) {
    if (row.value === null) continue;
    try {
      const value = JSON.parse(row.value) as { projectId?: unknown };
      if (typeof value.projectId !== 'string') continue;
      const nextProjectId = mapId('projects', value.projectId);
      if (nextProjectId !== value.projectId) {
        await database.runAsync(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, [JSON.stringify({ ...value, projectId: nextProjectId }), row.id]);
      }
    } catch {
      // Existing rows may contain a legacy malformed patch; leave it intact.
    }
  }
}

async function migrateNativeSyncMetadata(
  database: SQLiteDatabase,
  mapId = (entityType: string, id: string): string => isUuid(id) ? id : stableLegacyUuid(entityType, id),
): Promise<void> {
  const state = await database.getFirstAsync<{ device_id: string }>('SELECT device_id FROM sync_state WHERE id = 1');
  if (state !== null && !isUuid(state.device_id)) {
    await database.runAsync('UPDATE sync_state SET device_id = ? WHERE id = 1', [stableLegacyUuid('sync_devices', state.device_id)]);
  }
  const versions = await database.getAllAsync<{ entity_type: SyncEntityType; entity_id: string; version: number }>('SELECT entity_type, entity_id, version FROM sync_entity_versions');
  for (const row of versions) {
    const nextId = mapId(row.entity_type, row.entity_id);
    if (nextId !== row.entity_id) {
      await database.runAsync('DELETE FROM sync_entity_versions WHERE entity_type = ? AND entity_id = ?', [row.entity_type, row.entity_id]);
      await database.runAsync('INSERT OR REPLACE INTO sync_entity_versions (entity_type, entity_id, version) VALUES (?, ?, ?)', [row.entity_type, nextId, row.version]);
    }
  }
  const mutations = await database.getAllAsync<{ mutation_id: string; device_id: string; entity_type: SyncEntityType; entity_id: string; payload_json: string }>('SELECT mutation_id, device_id, entity_type, entity_id, payload_json FROM sync_outbox');
  for (const mutation of mutations) {
    const nextMutationId = isUuid(mutation.mutation_id) ? mutation.mutation_id : stableLegacyUuid('sync_mutations', mutation.mutation_id);
    const nextDeviceId = isUuid(mutation.device_id) ? mutation.device_id : stableLegacyUuid('sync_devices', mutation.device_id);
    const nextEntityId = mapId(mutation.entity_type, mutation.entity_id);
    const nextPayload = mapNativeSyncPayload(mutation.entity_type, mutation.payload_json, mapId);
    if (nextMutationId !== mutation.mutation_id) {
      await database.runAsync('UPDATE sync_outbox SET mutation_id = ?, device_id = ?, entity_id = ?, payload_json = ? WHERE mutation_id = ?', [nextMutationId, nextDeviceId, nextEntityId, nextPayload, mutation.mutation_id]);
    } else if (nextDeviceId !== mutation.device_id || nextEntityId !== mutation.entity_id || nextPayload !== mutation.payload_json) {
      await database.runAsync('UPDATE sync_outbox SET device_id = ?, entity_id = ?, payload_json = ? WHERE mutation_id = ?', [nextDeviceId, nextEntityId, nextPayload, mutation.mutation_id]);
    }
  }
}

function mapNativeSyncPayload(
  entityType: SyncEntityType,
  payloadJson: string,
  mapId: (entityType: string, id: string) => string,
): string {
  try {
    const value = JSON.parse(payloadJson) as Record<string, unknown>;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return payloadJson;
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
      value.taskPatch = JSON.parse(mapNativeSyncPayload('task_items', JSON.stringify(value.taskPatch), mapId));
    }
    return JSON.stringify(value);
  } catch {
    return payloadJson;
  }
}
