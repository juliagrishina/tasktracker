import type { AppDataSource } from './contracts';
import type { LocalDataScope } from './local-data-scopes';

export type SyncEntityType =
  | 'projects' | 'task_items' | 'reminders' | 'schedule_blocks'
  | 'recurrence_series' | 'recurrence_occurrences' | 'recurrence_revisions'
  | 'transfer_history' | 'daily_energy_entries' | 'user_settings';

export interface SyncOutboxMutation {
  mutationId: string;
  deviceId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: 'upsert' | 'delete';
  expectedVersion: number;
  dataGeneration: number;
  payload: unknown;
  createdAt: string;
}

export interface SyncMetadataDataSource {
  enqueueSyncMutation(input: Omit<SyncOutboxMutation, 'mutationId' | 'deviceId' | 'expectedVersion' | 'dataGeneration' | 'createdAt'>): Promise<SyncOutboxMutation>;
  listSyncOutbox(): Promise<readonly SyncOutboxMutation[]>;
}

export function createLocalSyncId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export type SyncTrackingDataSource = AppDataSource & Pick<SyncMetadataDataSource, 'listSyncOutbox'>;

type MutationDefinition = { entityType: SyncEntityType; operation: 'upsert' | 'delete'; entityId: (value: unknown) => string; payload: (value: unknown) => unknown };
type CapturedEntity = { entityType: SyncEntityType; entityId: string; payload: unknown };

const mutationDefinitions: Readonly<Record<string, MutationDefinition>> = {
  saveProject: entity('projects'), saveTaskItem: entity('task_items'), saveReminder: entity('reminders'),
  saveScheduleBlock: entity('schedule_blocks'), saveRecurrenceSeries: entity('recurrence_series'),
  saveRecurrenceOccurrence: entity('recurrence_occurrences'), saveRecurrenceRevision: entity('recurrence_revisions'),
  saveTransferHistory: entity('transfer_history'), saveDailyEnergyEntry: entity('daily_energy_entries', (value) => String((value as { recordedOn: string }).recordedOn)),
  saveSettings: { entityType: 'user_settings', operation: 'upsert', entityId: () => 'settings', payload: sanitizePayload },
  deleteProject: deletion('projects'), deleteTaskItem: deletion('task_items'), deleteReminder: deletion('reminders'),
  deleteScheduleBlock: deletion('schedule_blocks'), deleteRecurrenceSeries: deletion('recurrence_series'),
  deleteRecurrenceOccurrence: deletion('recurrence_occurrences'), deleteRecurrenceRevision: deletion('recurrence_revisions'),
};

function entity(entityType: SyncEntityType, entityId = (value: unknown) => String((value as { id: string }).id)): MutationDefinition {
  return { entityType, operation: 'upsert', entityId, payload: sanitizePayload };
}

function deletion(entityType: SyncEntityType): MutationDefinition {
  return { entityType, operation: 'delete', entityId: (value) => String(value), payload: (value) => ({ id: String(value) }) };
}

function sanitizePayload(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const payload = { ...(value as Record<string, unknown>) };
  delete payload.notificationId;
  delete payload.notificationIds;
  delete payload.eveningReviewNotificationId;
  return payload;
}

export function createSyncTrackingDataSource(source: AppDataSource, scope: LocalDataScope): SyncTrackingDataSource {
  const metadata = source as AppDataSource & SyncMetadataDataSource;
  let transactionDepth = 0;

  return new Proxy(source, {
    get(target, property, receiver) {
      if (property === 'listSyncOutbox') {
        return scope.kind === 'account' ? metadata.listSyncOutbox.bind(metadata) : async () => [];
      }
      if (property === 'transaction') {
        return async <T>(operation: () => Promise<T>): Promise<T> => {
          transactionDepth += 1;
          try { return await target.transaction(operation); } finally { transactionDepth -= 1; }
        };
      }

      const value = Reflect.get(target, property, receiver);
      if (typeof property !== 'string' || typeof value !== 'function' || scope.kind !== 'account') return value;
      const definition = mutationDefinitions[property];
      if (definition === undefined) return value;

      return async (...args: unknown[]) => {
        const execute = async () => {
          const before = definition.operation === 'delete'
            ? await captureLiveEntities(target as AppDataSource)
            : null;
          const result = await value.apply(target, args);
          if (before === null) {
            const item = args[0];
            await metadata.enqueueSyncMutation({
              entityType: definition.entityType,
              entityId: definition.entityId(item),
              operation: definition.operation,
              payload: definition.payload(item),
            });
          } else {
            const after = new Map((await captureLiveEntities(target as AppDataSource))
              .map((item) => [`${item.entityType}:${item.entityId}`, item]));
            for (const item of before) {
              const current = after.get(`${item.entityType}:${item.entityId}`);
              if (current === undefined) {
                await metadata.enqueueSyncMutation({
                  entityType: item.entityType,
                  entityId: item.entityId,
                  operation: 'delete',
                  payload: { id: item.entityId },
                });
              } else if (JSON.stringify(item.payload) !== JSON.stringify(current.payload)) {
                await metadata.enqueueSyncMutation({
                  entityType: current.entityType,
                  entityId: current.entityId,
                  operation: 'upsert',
                  payload: current.payload,
                });
              }
            }
          }
          return result;
        };
        return transactionDepth > 0 ? execute() : target.transaction(execute);
      };
    },
  }) as SyncTrackingDataSource;
}

async function captureLiveEntities(source: AppDataSource): Promise<readonly CapturedEntity[]> {
  const [projects, taskItems, reminders, scheduleBlocks, recurrenceSeries, transferHistories, dailyEnergyEntries] = await Promise.all([
    source.listProjects(),
    source.listTaskItems(),
    source.listReminders(),
    source.listScheduleBlocks(),
    source.listRecurrenceSeries(),
    source.listTransferHistories(),
    source.listDailyEnergyEntries(),
  ]);
  const recurrenceChildren = await Promise.all(recurrenceSeries.map(async (series) => ({
    occurrences: await source.listRecurrenceOccurrences(series.id),
    revisions: await source.listRecurrenceRevisions(series.id),
  })));

  return [
    ...projects.map((item) => captured('projects', item.id, item)),
    ...taskItems.map((item) => captured('task_items', item.id, item)),
    ...reminders.map((item) => captured('reminders', item.id, item)),
    ...scheduleBlocks.map((item) => captured('schedule_blocks', item.id, item)),
    ...recurrenceSeries.map((item) => captured('recurrence_series', item.id, item)),
    ...recurrenceChildren.flatMap(({ occurrences, revisions }) => [
      ...occurrences.map((item) => captured('recurrence_occurrences', item.id, item)),
      ...revisions.map((item) => captured('recurrence_revisions', item.id, item)),
    ]),
    ...transferHistories.map((item) => captured('transfer_history', item.id, item)),
    ...dailyEnergyEntries.map((item) => captured('daily_energy_entries', item.recordedOn, item)),
  ];
}

function captured(entityType: SyncEntityType, entityId: string, payload: unknown): CapturedEntity {
  return { entityType, entityId, payload: sanitizePayload(payload) };
}
