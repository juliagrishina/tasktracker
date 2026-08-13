import type {
  EntityId,
  RecurrenceOccurrence,
  RecurrenceSeries,
  Reminder,
  ReminderOccurrencePatch,
  ScheduleBlock,
  TaskOccurrencePatch,
  TaskItem,
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
  estimatedDurationMinutes?: number | null;
  blocks: readonly ScheduleBlock[];
  deletedBlockIds?: readonly EntityId[];
  recurrence?: PlanningRecurrenceInput | null;
}

export interface SaveReminderPlanningInput {
  reminderId: EntityId;
  remindsOn?: string | null;
  periodStartOn?: string | null;
  periodEndOn?: string | null;
  estimatedDurationMinutes?: number | null;
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
  completedAt?: string | null;
  taskPatch?: TaskOccurrencePatch;
  reminderPatch?: ReminderOccurrencePatch;
  blocks?: readonly ScheduleBlock[];
  createdAt: string;
}

export interface PlanOccurrenceContext {
  id: string;
  seriesId: string;
  occursOn: string;
  frequency: RecurrenceSeries['frequency'];
  interval: number;
  startsOn: string;
}

export type UntimedTaskPlanEntry = TaskItem & {
  occurrence?: PlanOccurrenceContext;
};

export type UntimedReminderPlanEntry = Reminder & {
  occurrence?: PlanOccurrenceContext;
};

export interface UntimedPlanEntries {
  tasks: readonly UntimedTaskPlanEntry[];
  reminders: readonly UntimedReminderPlanEntry[];
}

export type SaveTaskPlanningResult =
  | { conflict: null }
  | { conflict: readonly ScheduleConflict[] };

export type ReminderPlanningPatch = Pick<
  Reminder,
  'remindsOn' | 'periodStartOn' | 'periodEndOn' | 'repeatRule'
>;
