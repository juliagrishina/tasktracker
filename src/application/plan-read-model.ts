import type { AppSettings, ScheduleBlock, TaskItem } from '../domain/entities';
import { getDayLoadPercent } from '../domain/planning';

import type { PlanUntimedReminder, PlanUntimedTask } from './planning-use-cases';

export interface PlanReadModelReader {
  getPlanScheduleBlocks(isoDate: string): Promise<readonly ScheduleBlock[]>;
  getPlanUntimedReminders(isoDate: string): Promise<readonly PlanUntimedReminder[]>;
  getPlanUntimedTasks(isoDate: string): Promise<readonly PlanUntimedTask[]>;
  getTaskItem(taskId: string): Promise<TaskItem | null>;
}

export interface PlanDayReadModel {
  blocks: readonly ScheduleBlock[];
  loadPercent: number;
  taskById: ReadonlyMap<string, TaskItem>;
  untimedReminders: readonly PlanUntimedReminder[];
  untimedTasks: readonly PlanUntimedTask[];
}

export interface PlanReadModel {
  byDate: Readonly<Record<string, PlanDayReadModel>>;
}

export async function loadPlanReadModel(reader: PlanReadModelReader, settings: AppSettings, isoDates: readonly string[]): Promise<PlanReadModel> {
  const dates = [...new Set(isoDates)];
  const loadedDays = await Promise.all(dates.map(async (isoDate) => {
    const [blocks, untimedReminders, untimedTasks] = await Promise.all([
      reader.getPlanScheduleBlocks(isoDate),
      reader.getPlanUntimedReminders(isoDate),
      reader.getPlanUntimedTasks(isoDate),
    ]);
    return { blocks, isoDate, untimedReminders, untimedTasks };
  }));
  const taskIds = [...new Set(loadedDays.flatMap((day) => day.blocks.map((block) => block.taskItemId)))];
  const loadedTasks = await Promise.all(taskIds.map(async (taskId) => [taskId, await reader.getTaskItem(taskId)] as const));
  const taskById = new Map(loadedTasks.filter((entry): entry is readonly [string, TaskItem] => entry[1] !== null));
  const byDate = Object.fromEntries(loadedDays.map((day) => {
    const estimatedMinutes = [...day.untimedReminders, ...day.untimedTasks]
      .reduce((total, item) => total + (item.estimatedDurationMinutes ?? 0), 0);
    return [day.isoDate, {
      blocks: day.blocks,
      loadPercent: getDayLoadPercent(settings, day.blocks, day.isoDate, estimatedMinutes),
      taskById,
      untimedReminders: day.untimedReminders,
      untimedTasks: day.untimedTasks,
    } satisfies PlanDayReadModel];
  }));
  return { byDate };
}
