import type { EntityId, RecurrenceOccurrence, RecurrenceSeries, ScheduleBlock } from '../domain/entities';

export interface PlanningRecurrenceInput {
  id: EntityId;
  frequency: RecurrenceSeries['frequency'];
  interval: number;
  startsOn: string;
  createdAt: string;
}

export interface ScheduleConflict { candidate: ScheduleBlock; block: ScheduleBlock; }
export interface SaveTaskPlanningInput {
  taskId: EntityId;
  blocks: readonly ScheduleBlock[];
  deletedBlockIds?: readonly EntityId[];
  recurrence?: PlanningRecurrenceInput | null;
}
export interface SaveOccurrenceExceptionInput {
  occurrence: RecurrenceOccurrence;
  blocks?: readonly ScheduleBlock[];
}
export type SaveTaskPlanningResult = { conflict: null } | { conflict: readonly ScheduleConflict[] };
