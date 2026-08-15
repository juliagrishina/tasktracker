import { supabase } from './supabase-client';

export type EventEntityType = 'project' | 'task_item' | 'reminder';

/**
 * Full event vocabulary for the append-only `events` history. Only the
 * first four are actually recorded today — each has a real use-case call
 * site (see backlog-use-cases.ts, convert-reminder-to-task.ts). The rest
 * are reserved so the features that will emit them (scheduling, reopening)
 * don't need a schema/vocabulary change when they land.
 */
export type EventType =
  | 'task_created'
  | 'task_completed'
  | 'task_deleted'
  | 'reminder_converted_to_task'
  | 'task_scheduled'
  | 'task_rescheduled'
  | 'task_unscheduled'
  | 'task_reopened';

interface RecordEventInput {
  entityType: EventEntityType;
  entityId: string;
  eventType: EventType;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}

/**
 * Best-effort, fire-and-forget write to Supabase. Never throws: the app
 * is local-first, so a missing session or an offline device must not
 * block or fail the underlying (local) use-case.
 */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError !== null || userData.user === null) {
    return;
  }

  const { error } = await supabase.from('events').insert({
    user_id: userData.user.id,
    entity_type: input.entityType,
    entity_id: input.entityId,
    event_type: input.eventType,
    payload: input.payload ?? {},
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  });

  if (error !== null) {
    console.warn('Не удалось записать событие', input.eventType, error.message);
  }
}
