import type { AppDataSource } from '../data/contracts';
import { createTaskFromReminder } from '../domain/reminder-conversion';
import {
  findScheduleConflicts,
  getDayLoadPercent,
  getRecurrenceDates,
} from '../domain/planning';
import type {
  EntityId,
  PlanningItemKind,
  RecurrenceOccurrence,
  RecurrenceSeries,
  Reminder,
  ScheduleBlock,
  TaskItem,
} from '../domain/entities';

import type {
  ConvertReminderAndScheduleInput,
  PlanningRecurrenceInput,
  ResolveScheduleConflictInput,
  SaveOccurrenceExceptionInput,
  SaveReminderPlanningInput,
  SaveTaskPlanningInput,
  SaveTaskPlanningResult,
  ScheduleConflict,
} from './planning-types';

function compareConflicts(left: ScheduleConflict, right: ScheduleConflict): number {
  return (
    left.candidate.startsAt.localeCompare(right.candidate.startsAt) ||
    left.candidate.id.localeCompare(right.candidate.id) ||
    left.block.startsAt.localeCompare(right.block.startsAt) ||
    left.block.id.localeCompare(right.block.id)
  );
}

function toSeries(
  recurrence: PlanningRecurrenceInput,
  itemKind: PlanningItemKind,
  itemId: EntityId,
): RecurrenceSeries {
  return {
    id: recurrence.id,
    itemKind,
    itemId,
    frequency: recurrence.frequency,
    interval: recurrence.interval,
    startsOn: recurrence.startsOn,
    createdAt: recurrence.createdAt,
  };
}

async function getExistingTask(source: AppDataSource, id: EntityId): Promise<TaskItem> {
  const task = await source.getTaskItem(id);
  if (task === null) {
    throw new Error('Задача для планирования не найдена');
  }
  return task;
}

async function getExistingReminder(source: AppDataSource, id: EntityId): Promise<Reminder> {
  const reminder = await source.getReminder(id);
  if (reminder === null) {
    throw new Error('Напоминание для планирования не найдено');
  }
  return reminder;
}

async function replacePlanningRecurrence(
  source: AppDataSource,
  itemKind: PlanningItemKind,
  itemId: EntityId,
  recurrence: PlanningRecurrenceInput | null | undefined,
): Promise<void> {
  if (recurrence === undefined) {
    return;
  }

  const existingSeries = (await source.listRecurrenceSeries()).filter(
    (series) => series.itemKind === itemKind && series.itemId === itemId,
  );
  for (const series of existingSeries) {
    await source.deleteRecurrenceSeries(series.id);
  }

  if (recurrence !== null) {
    await source.saveRecurrenceSeries(toSeries(recurrence, itemKind, itemId));
  }
}

function getConflicts(
  candidates: readonly ScheduleBlock[],
  existingBlocks: readonly ScheduleBlock[],
): readonly ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  for (const candidate of candidates) {
    const otherCandidates = candidates.filter((other) => other.id !== candidate.id);
    const conflictsForCandidate = findScheduleConflicts(candidate, [
      ...existingBlocks,
      ...otherCandidates,
    ]);
    conflicts.push(
      ...conflictsForCandidate.map((block) => ({ candidate, block })),
    );
  }

  return conflicts.sort(compareConflicts);
}

function applyOptionalPatch<T>(value: T | undefined, current: T): T {
  return value === undefined ? current : value;
}

export async function saveTaskPlanning(
  source: AppDataSource,
  input: SaveTaskPlanningInput,
): Promise<SaveTaskPlanningResult> {
  const task = await getExistingTask(source, input.taskId);
  const existingBlocks = await source.listScheduleBlocks();
  const conflicts = getConflicts(input.blocks, existingBlocks);

  await source.transaction(async () => {
    await source.saveTaskItem({
      ...task,
      scheduledOn: applyOptionalPatch(input.scheduledOn, task.scheduledOn),
      periodStartOn: applyOptionalPatch(input.periodStartOn, task.periodStartOn),
      periodEndOn: applyOptionalPatch(input.periodEndOn, task.periodEndOn),
    });
    await replacePlanningRecurrence(source, 'task', task.id, input.recurrence);

    if (conflicts.length === 0) {
      for (const block of input.blocks) {
        await source.saveScheduleBlock(block);
      }
    }
  });

  return conflicts.length === 0 ? { conflict: null } : { conflict: conflicts };
}

export async function saveReminderPlanning(
  source: AppDataSource,
  input: SaveReminderPlanningInput,
): Promise<Reminder> {
  const reminder = await getExistingReminder(source, input.reminderId);
  const repeatRule =
    input.recurrence === undefined
      ? reminder.repeatRule
      : input.recurrence === null
        ? null
        : {
            frequency: input.recurrence.frequency,
            interval: input.recurrence.interval,
          };
  const updatedReminder: Reminder = {
    ...reminder,
    remindsOn: applyOptionalPatch(input.remindsOn, reminder.remindsOn),
    periodStartOn: applyOptionalPatch(input.periodStartOn, reminder.periodStartOn),
    periodEndOn: applyOptionalPatch(input.periodEndOn, reminder.periodEndOn),
    repeatRule,
  };

  await source.transaction(async () => {
    await source.saveReminder(updatedReminder);
    await replacePlanningRecurrence(source, 'reminder', reminder.id, input.recurrence);
  });

  return updatedReminder;
}

export async function resolveScheduleConflict(
  source: AppDataSource,
  input: ResolveScheduleConflictInput,
): Promise<void> {
  if (input.decision === 'cancel') {
    return;
  }

  await source.transaction(async () => {
    for (const block of input.blocks) {
      await source.saveScheduleBlock(block);
    }
  });
}

export async function convertReminderAndSchedule(
  source: AppDataSource,
  input: ConvertReminderAndScheduleInput,
): Promise<TaskItem> {
  let task: TaskItem | null = null;

  await source.transaction(async () => {
    const reminder = await getExistingReminder(source, input.reminderId);
    if (input.projectId !== null && (await source.getProject(input.projectId)) === null) {
      throw new Error('Проект для преобразованного напоминания не найден');
    }

    task = {
      ...createTaskFromReminder(reminder, input.taskId, input.createdAt),
      projectId: input.projectId,
    };
    await source.saveTaskItem(task);
    await source.saveScheduleBlock(input.block);

    const reminderSeries = (await source.listRecurrenceSeries()).filter(
      (series) => series.itemKind === 'reminder' && series.itemId === reminder.id,
    );
    if (reminderSeries.length > 0) {
      for (const series of reminderSeries) {
        await source.saveRecurrenceSeries({
          ...series,
          itemKind: 'task',
          itemId: task.id,
        });
      }
    } else if (reminder.repeatRule !== null) {
      await source.saveRecurrenceSeries({
        id: input.recurrenceSeriesId ?? `recurrence-${task.id}`,
        itemKind: 'task',
        itemId: task.id,
        frequency: reminder.repeatRule.frequency,
        interval: reminder.repeatRule.interval,
        startsOn:
          reminder.remindsOn ??
          reminder.periodStartOn ??
          reminder.periodEndOn ??
          input.createdAt.slice(0, 10),
        createdAt: input.createdAt,
      });
    }

    await source.deleteReminder(reminder.id);
  });

  if (task === null) {
    throw new Error('Не удалось преобразовать напоминание в задачу');
  }

  return task;
}

export async function saveOccurrenceException(
  source: AppDataSource,
  input: SaveOccurrenceExceptionInput,
): Promise<RecurrenceOccurrence> {
  const occurrence: RecurrenceOccurrence = {
    id: input.id,
    seriesId: input.seriesId,
    occursOn: input.occursOn,
    status: input.status,
    createdAt: input.createdAt,
  };

  await source.transaction(async () => {
    await source.saveRecurrenceOccurrence(occurrence);
  });

  return occurrence;
}

export function getOccurrenceDates(
  series: RecurrenceSeries,
  rangeStartOn: string,
  rangeEndOn: string,
): string[] {
  return getRecurrenceDates(series, rangeStartOn, rangeEndOn);
}

export async function getPlanLoad(
  source: AppDataSource,
  isoDate: string,
): Promise<number> {
  const [settings, blocks] = await Promise.all([
    source.getSettings(),
    source.listScheduleBlocks(),
  ]);
  return getDayLoadPercent(settings, blocks, isoDate);
}
