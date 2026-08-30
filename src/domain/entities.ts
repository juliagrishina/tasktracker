export type EntityId = string;

export interface BacklogRepeatRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'intervalDays';
  interval: number;
  weekdays?: readonly number[];
}

export interface Project {
  id: EntityId;
  title: string;
  description: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type TaskItem =
  | {
      id: EntityId;
      kind: 'task';
      projectId: EntityId | null;
      parentTaskId: null;
      title: string;
      description: string | null;
      estimatedDurationMinutes: number | null;
      scheduledOn?: string | null;
      periodStartOn?: string | null;
      periodEndOn?: string | null;
      completedAt: string | null;
      createdAt: string;
      updatedAt: string;
      deletedAt: string | null;
    }
  | {
      id: EntityId;
      kind: 'subtask';
      projectId: EntityId | null;
      parentTaskId: EntityId;
      title: string;
      description: string | null;
      estimatedDurationMinutes: number | null;
      scheduledOn?: string | null;
      periodStartOn?: string | null;
      periodEndOn?: string | null;
      completedAt: string | null;
      createdAt: string;
      updatedAt: string;
      deletedAt: string | null;
    };

export interface Reminder {
  id: EntityId;
  title: string;
  linkedTaskItemId?: EntityId | null;
  linkedOccurrenceOn?: string | null;
  remindsOn: string | null;
  periodStartOn: string | null;
  periodEndOn: string | null;
  repeatRule: BacklogRepeatRule | null;
  estimatedDurationMinutes: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ScheduleBlock {
  id: EntityId;
  taskItemId: EntityId;
  occurrenceId: EntityId | null;
  notificationId?: string | null;
  timeZoneId: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** Ephemeral display data for a revised recurring series; it is never persisted with the block. */
  displayTaskPatch?: RecurrenceTaskPatch;
}

export interface RecurrenceSeries {
  id: EntityId;
  itemKind: 'task' | 'reminder';
  itemId: EntityId;
  frequency: BacklogRepeatRule['frequency'];
  interval: number;
  weekdays?: readonly number[];
  startsOn: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface RecurrenceOccurrence {
  id: EntityId;
  seriesId: EntityId;
  occursOn: string;
  cancelledAt: string | null;
  completedAt: string | null;
  blocksOverridden: boolean;
  taskPatch: RecurrenceTaskPatch | null;
  reminderPatch: Partial<Pick<Reminder, 'title' | 'estimatedDurationMinutes' | 'remindsOn'>> | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  notificationIds?: readonly string[];
}

export interface TransferHistory {
  id: EntityId;
  taskItemId: EntityId;
  reason: string | null;
  returnedAt: string;
  createdAt: string;
}

export type RecurrenceTaskPatch = Partial<Pick<TaskItem, 'title' | 'description' | 'estimatedDurationMinutes' | 'projectId' | 'scheduledOn' | 'periodStartOn' | 'periodEndOn'>>;

export interface RecurrenceBlockTemplate {
  timeZoneId: string;
  startsAt: string;
  endsAt: string;
}

/** A forward-only change to a recurring task. Earlier instances keep the prior rule and details. */
export interface RecurrenceRevision {
  id: EntityId;
  seriesId: EntityId;
  effectiveFrom: string;
  frequency: BacklogRepeatRule['frequency'];
  interval: number;
  weekdays?: readonly number[];
  taskPatch: RecurrenceTaskPatch;
  blockTemplates: readonly RecurrenceBlockTemplate[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** A single morning energy mark for a local calendar day. A null value is an explicit skip. */
export interface DailyEnergyEntry {
  recordedOn: string;
  energyPercent: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  timeZoneId: string;
  timeZoneMode?: 'device' | 'manual';
  workdayStartsAt: string;
  workdayEndsAt: string;
  eveningReviewAt: string;
  eveningReviewNotificationId?: string | null;
  notificationLeadMinutes: number;
  completionPromptDeferredOn?: string | null;
}
