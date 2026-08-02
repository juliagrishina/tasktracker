export type EntityId = string;

export interface BacklogRepeatRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
}

export interface Project {
  id: EntityId;
  title: string;
  description: string | null;
  completedAt: string | null;
  createdAt: string;
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
      completedAt: string | null;
      createdAt: string;
    }
  | {
      id: EntityId;
      kind: 'subtask';
      projectId: EntityId | null;
      parentTaskId: EntityId;
      title: string;
      description: string | null;
      estimatedDurationMinutes: number | null;
      completedAt: string | null;
      createdAt: string;
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
}

export interface ScheduleBlock {
  id: EntityId;
  taskItemId: EntityId;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

export interface RecurrenceSeries {
  id: EntityId;
  taskItemId: EntityId;
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  startsOn: string;
  createdAt: string;
}

export interface CompletedItem {
  id: EntityId;
  taskItemId: EntityId;
  completedAt: string;
  createdAt: string;
}

export interface AppSettings {
  workdayStartsAt: string;
  workdayEndsAt: string;
  eveningReviewAt: string;
  notificationLeadMinutes: number;
}
