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
  timeZoneId: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
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
  taskPatch: Partial<Pick<TaskItem, 'title' | 'description' | 'estimatedDurationMinutes' | 'scheduledOn'>> | null;
  reminderPatch: Partial<Pick<Reminder, 'title' | 'estimatedDurationMinutes' | 'remindsOn'>> | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TransferHistory {
  id: EntityId;
  taskItemId: EntityId;
  reason: string | null;
  returnedAt: string;
  createdAt: string;
}

export interface AppSettings {
  timeZoneId: string;
  workdayStartsAt: string;
  workdayEndsAt: string;
  eveningReviewAt: string;
  notificationLeadMinutes: number;
}
