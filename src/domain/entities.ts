export type EntityId = string;

export interface Project {
  id: EntityId;
  title: string;
  createdAt: string;
}

export type TaskItem =
  | {
      id: EntityId;
      kind: 'task';
      projectId: EntityId | null;
      parentTaskId: null;
      title: string;
      createdAt: string;
    }
  | {
      id: EntityId;
      kind: 'subtask';
      projectId: EntityId | null;
      parentTaskId: EntityId;
      title: string;
      createdAt: string;
    };

export interface Reminder {
  id: EntityId;
  title: string;
  taskItemId: EntityId | null;
  projectId: EntityId | null;
  remindsAt: string;
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
