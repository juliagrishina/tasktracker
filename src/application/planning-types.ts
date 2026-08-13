import type {
  EntityId,
  RecurrenceOccurrence,
  RecurrenceSeries,
  Reminder,
  ScheduleBlock,
  TaskOccurrencePatch,
} from '../domain/entities';

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
}

export interface SaveTaskPlanningInput {
  taskId: EntityId;
  scheduledOn?: string | null;
  periodStartOn?: string | null;
  periodEndOn?: string | null;
  blocks: readonly ScheduleBlock[];
  deletedBlockIds?: readonly EntityId[];
  recurrence?: PlanningRecurrenceInput | null;
}

export interface SaveReminderPlanningInput {
  reminderId: EntityId;
  remindsOn?: string | null;
  periodStartOn?: string | null;
  periodEndOn?: string | null;
  recurrence?: PlanningRecurrenceInput | null;
}

export interface ResolveScheduleConflictInput {
  decision: 'cancel' | 'save';
  blocks: readonly ScheduleBlock[];
  deletedBlockIds?: readonly EntityId[];
}

export interface ConvertReminderAndScheduleInput {
  reminderId: EntityId;
  projectId: EntityId | null;
  taskId: EntityId;
  block: ScheduleBlock;
  createdAt: string;
  recurrenceSeriesId?: EntityId;
}

export interface SaveOccurrenceExceptionInput {
  id: EntityId;
  seriesId: EntityId;
  occursOn: string;
  status: RecurrenceOccurrence['status'];
  taskPatch?: TaskOccurrencePatch;
  blocks?: readonly ScheduleBlock[];
  createdAt: string;
}

export type SaveTaskPlanningResult =
  | { conflict: null }
  | { conflict: readonly ScheduleConflict[] };

export type ReminderPlanningPatch = Pick<
  Reminder,
  'remindsOn' | 'periodStartOn' | 'periodEndOn' | 'repeatRule'
>;
