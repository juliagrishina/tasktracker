import type { RemoteSyncChange, SyncMutationResult, SyncOutboxMutation } from './sync-outbox';

export interface SupabaseSyncClient {
  functions: {
    invoke(name: string, options: { body: unknown }): Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

export function createSupabaseSyncGateway(client: SupabaseSyncClient | null) {
  const invoke = async (body: unknown): Promise<Record<string, unknown>> => {
    if (client === null) throw new Error('Cloud sync is unavailable.');
    const { data, error } = await client.functions.invoke('sync-protocol', { body });
    if (error !== null || data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error('Cloud sync request failed.');
    return data as Record<string, unknown>;
  };
  return {
    push: async (mutations: readonly SyncOutboxMutation[]): Promise<readonly SyncMutationResult[]> => {
      const response = await invoke({ mutations });
      if (!Array.isArray(response.mutations)) throw new Error('Cloud sync response is invalid.');
      return response.mutations as SyncMutationResult[];
    },
    pull: async (cursor: number, limit: number): Promise<readonly RemoteSyncChange[]> => {
      const response = await invoke({ cursor, limit });
      if (!Array.isArray(response.changes)) throw new Error('Cloud sync response is invalid.');
      return response.changes.map(decodeChange);
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
