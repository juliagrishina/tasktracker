import type { IncomingSyncConflict, RemoteSyncChange, SyncMutationResult, SyncOutboxMutation, SyncPushResponse } from './sync-outbox';

export interface SupabaseSyncClient {
  functions: {
    invoke(name: string, options: { body: Record<string, unknown> }): Promise<{ data: unknown; error: { message: string; context?: { clone(): { json(): Promise<unknown> } } } | null }>;
  };
}

export function createSupabaseSyncGateway(client: SupabaseSyncClient | null) {
  const invoke = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    if (client === null) throw new Error('Cloud sync is unavailable.');
    const { data, error } = await client.functions.invoke('sync-protocol', { body });
    if (error !== null) {
      const response = await error.context?.clone().json().catch(() => null);
      const code = response !== null && typeof response === 'object' && 'code' in response
        ? (response as { code?: unknown }).code
        : undefined;
      throw Object.assign(new Error('Cloud sync request failed.'), { code });
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error('Cloud sync response is invalid.');
    return data as Record<string, unknown>;
  };
  return {
    push: async (mutations: readonly SyncOutboxMutation[]): Promise<SyncPushResponse> => {
      const response = await invoke({ mutations });
      if (!Array.isArray(response.mutations) || !Array.isArray(response.conflicts)) throw new Error('Cloud sync response is invalid.');
      return { mutations: response.mutations as SyncMutationResult[], conflicts: response.conflicts.map(decodeConflict) };
    },
    pull: async (cursor: number, limit: number): Promise<readonly RemoteSyncChange[]> => {
      const response = await invoke({ cursor, limit });
      if (!Array.isArray(response.changes)) throw new Error('Cloud sync response is invalid.');
      return response.changes.map(decodeChange);
    },
    getDataGeneration: async (): Promise<number> => {
      const response = await invoke({ bootstrap: true });
      if (typeof response.dataGeneration !== 'number') throw new Error('Cloud sync response is invalid.');
      return response.dataGeneration;
    },
  };
}

function decodeConflict(value: unknown): IncomingSyncConflict {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Cloud sync conflict is invalid.');
  const conflict = value as Record<string, unknown>;
  const local = conflict.local;
  const server = conflict.server;
  if (local === null || typeof local !== 'object' || Array.isArray(local) || server === null || typeof server !== 'object' || Array.isArray(server)) throw new Error('Cloud sync conflict is invalid.');
  const snapshot = server as Record<string, unknown>;
  if (typeof snapshot.operation !== 'string' || typeof snapshot.version !== 'number' || typeof snapshot.changed_at !== 'string') throw new Error('Cloud sync conflict is invalid.');
  return {
    local: local as SyncOutboxMutation,
    server: {
      operation: snapshot.operation as SyncOutboxMutation['operation'],
      version: snapshot.version,
      payload: decodePayload((local as SyncOutboxMutation).entityType, snapshot.payload),
      changedAt: snapshot.changed_at,
      deviceId: typeof snapshot.device_id === 'string' ? snapshot.device_id : null,
    },
  };
}

function decodeChange(value: unknown): RemoteSyncChange {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Cloud sync change is invalid.');
  const change = value as Record<string, unknown>;
  if (typeof change.change_cursor !== 'number' || typeof change.entity_type !== 'string' || typeof change.entity_id !== 'string' || typeof change.operation !== 'string' || typeof change.version !== 'number') throw new Error('Cloud sync change is invalid.');
  return {
    changeCursor: change.change_cursor,
    entityType: change.entity_type as RemoteSyncChange['entityType'],
    entityId: change.entity_id,
    operation: change.operation as RemoteSyncChange['operation'],
    version: change.version,
    payload: decodePayload(change.entity_type, change.payload),
  };
}

function decodePayload(entityType: string, payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const source = payload as Record<string, unknown>;
  const result = Object.fromEntries(Object.entries(source).map(([key, value]) => [camelize(key), value]));
  delete result.userId;
  delete result.version;
  if (entityType === 'reminders') {
    result.repeatRule = result.repeatFrequency === null ? null : { frequency: result.repeatFrequency, interval: result.repeatInterval, weekdays: result.repeatWeekdaysJson ?? undefined };
    delete result.repeatFrequency; delete result.repeatInterval; delete result.repeatWeekdaysJson;
  }
  if (entityType === 'recurrence_series' || entityType === 'recurrence_revisions') {
    result.weekdays = result.weekdaysJson ?? undefined;
    delete result.weekdaysJson;
  }
  if (entityType === 'recurrence_occurrences') {
    result.taskPatch = result.taskPatchJson ?? null; result.reminderPatch = result.reminderPatchJson ?? null;
    delete result.taskPatchJson; delete result.reminderPatchJson;
  }
  if (entityType === 'recurrence_revisions') {
    result.taskPatch = result.taskPatchJson ?? {}; result.blockTemplates = result.blockTemplatesJson ?? [];
    delete result.taskPatchJson; delete result.blockTemplatesJson;
  }
  return result;
}

function camelize(value: string): string {
  return value.replace(/_([a-z])/gu, (_match, letter: string) => letter.toUpperCase());
}
