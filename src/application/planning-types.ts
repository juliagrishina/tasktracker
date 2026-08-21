import type { EntityId, RecurrenceOccurrence, RecurrenceSeries, Reminder, ScheduleBlock } from '../domain/entities';

export interface PlanningRecurrenceInput {
  id: EntityId;
  frequency: RecurrenceSeries['frequency'];
  interval: number;
  startsOn: string;
  createdAt: string;
}

export interface ScheduleConflict {
  candidate: ScheduleBlock;
  block: ScheduleBlock;
  itemTitle: string;
  startsAt: string;
  endsAt: string;
}
export interface TaskPlacementInput {
  scheduledOn: string | null;
  periodStartOn: string | null;
  periodEndOn: string | null;
}
export interface SaveTaskPlanningInput {
  taskId: EntityId;
  blocks: readonly ScheduleBlock[];
  deletedBlockIds?: readonly EntityId[];
  forceConflicts?: boolean;
  recurrence?: PlanningRecurrenceInput | null;
  placement?: TaskPlacementInput;
}
export interface SaveOccurrenceExceptionInput {
  occurrence: RecurrenceOccurrence;
  blocks?: readonly ScheduleBlock[];
}

export interface SaveTaskWithPlanningInput {
  task: {
    mode: 'create' | 'edit';
    kind: 'task' | 'subtask';
    id: EntityId;
    title: string;
    description: string;
    estimatedDurationMinutes: number | null;
    projectId: EntityId | null;
    parentTaskId?: EntityId;
    createdAt: string;
  };
  planning: SaveTaskPlanningInput;
}

export interface MoveRecurrenceOccurrenceInput {
  seriesId: EntityId;
  occursOn: string;
  targetDate: string;
  scope: 'occurrence' | 'series';
}

export interface CreateTimedReminderTaskWithPlanningInput {
  reminder: {
    id: EntityId;
    title: string;
    remindsOn: string | null;
    periodStartOn: string | null;
    periodEndOn: string | null;
    repeatRule: Reminder['repeatRule'];
    estimatedDurationMinutes: number | null;
    createdAt: string;
  };
  taskId: EntityId;
  projectId: EntityId | null;
  planning: SaveTaskPlanningInput;
}
export type SaveTaskPlanningResult = { conflict: null } | { conflict: readonly ScheduleConflict[] };
