import type { AppDataSource } from '../data/contracts';
import { createTaskFromReminder } from '../domain/reminder-conversion';
import {
  assertPlanningDateRange,
  assertRecurrenceOccurrence,
  assertRecurrenceRule,
  doesScheduleBlockOverlapDate,
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

async function deleteSeriesAndExceptionBlocks(
  source: AppDataSource,
  seriesId: EntityId,
): Promise<void> {
  const occurrences = (await source.listRecurrenceOccurrences()).filter(
    (occurrence) => occurrence.seriesId === seriesId,
  );
  const occurrenceIds = new Set(occurrences.map((occurrence) => occurrence.id));
  for (const block of await source.listScheduleBlocks()) {
    if (block.occurrenceId !== null && occurrenceIds.has(block.occurrenceId)) {
      await source.deleteScheduleBlock(block.id);
    }
  }
  for (const occurrence of occurrences) {
    await source.deleteRecurrenceOccurrence(occurrence.id);
  }
  await source.deleteRecurrenceSeries(seriesId);
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
  if (recurrence === null) {
    for (const series of existingSeries) {
      await deleteSeriesAndExceptionBlocks(source, series.id);
    }
    return;
  }

  if (recurrence !== undefined) {
    const preservedSeries = existingSeries[0];
    const nextSeries = {
      ...toSeries(recurrence, itemKind, itemId),
      id: preservedSeries?.id ?? recurrence.id,
      createdAt: preservedSeries?.createdAt ?? recurrence.createdAt,
    };
    await source.saveRecurrenceSeries(nextSeries);
    const invalidOccurrences = (await source.listRecurrenceOccurrences()).filter((occurrence) => (
      occurrence.seriesId === nextSeries.id
      && !getRecurrenceDates(nextSeries, occurrence.occursOn, occurrence.occursOn)
        .includes(occurrence.occursOn)
    ));
    for (const occurrence of invalidOccurrences) {
      for (const block of await source.listScheduleBlocks()) {
        if (block.occurrenceId === occurrence.id) {
          await source.deleteScheduleBlock(block.id);
        }
      }
      await source.deleteRecurrenceOccurrence(occurrence.id);
    }
    for (const duplicateSeries of existingSeries.slice(1)) {
      await deleteSeriesAndExceptionBlocks(source, duplicateSeries.id);
    }
  }
}

function getConflicts(
  candidates: readonly ScheduleBlock[],
  existingBlocks: readonly ScheduleBlock[],
): readonly ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  for (const candidate of candidates) {
    const conflictsForCandidate = findScheduleConflicts(candidate, existingBlocks);
    conflicts.push(
      ...conflictsForCandidate.map((block) => ({ candidate, block })),
    );
  }

  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    const candidate = candidates[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const block = candidates[rightIndex];
      if (findScheduleConflicts(candidate, [block]).length > 0) {
        conflicts.push({ candidate, block });
      }
    }
  }

  return conflicts.sort(compareConflicts);
}

function applyOptionalPatch<T>(value: T | undefined, current: T): T {
  return value === undefined ? current : value;
}

function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftBlockToOccurrence(
  block: ScheduleBlock,
  series: RecurrenceSeries,
  occursOn: string,
): ScheduleBlock {
  const seriesStart = parseLocalDate(series.startsOn).getTime();
  const occurrenceDate = parseLocalDate(occursOn).getTime();
  const shiftDays = Math.round((occurrenceDate - seriesStart) / 86_400_000);

  const shiftDatePart = (dateTime: string) => {
    const date = parseLocalDate(dateTime.slice(0, 10));
    date.setDate(date.getDate() + shiftDays);
    return `${toIsoDate(date)}${dateTime.slice(10)}`;
  };

  return {
    ...block,
    id: `recurrence-${series.id}-${occursOn}-${block.id}`,
    startsAt: shiftDatePart(block.startsAt),
    endsAt: shiftDatePart(block.endsAt),
  };
}

export interface TaskPlanningSnapshot {
  blocks: readonly ScheduleBlock[];
  recurrence: RecurrenceSeries | null;
}

/**
 * Returns the persisted master schedule for a task editor. Instance-specific
 * blocks deliberately stay out of this snapshot: they belong to their
 * recurrence exception and must not be overwritten while editing the series.
 */
export async function getTaskPlanningSnapshot(
  source: AppDataSource,
  taskId: EntityId,
): Promise<TaskPlanningSnapshot> {
  await getExistingTask(source, taskId);
  const [blocks, recurrenceSeries] = await Promise.all([
    source.listScheduleBlocksForTaskItem(taskId),
    source.listRecurrenceSeries(),
  ]);

  return {
    blocks: blocks.filter((block) => block.occurrenceId === null),
    recurrence: recurrenceSeries.find((series) => (
      series.itemKind === 'task' && series.itemId === taskId
    )) ?? null,
  };
}

/**
 * Returns concrete blocks plus in-memory projections for the selected local day.
 * Recurring blocks are stored once at the series start and expanded only while
 * presenting the plan, so future instances remain independent of persistence.
 */
export async function getPlanScheduleBlocks(
  source: AppDataSource,
  isoDate: string,
): Promise<readonly ScheduleBlock[]> {
  const [blocks, series, occurrences] = await Promise.all([
    source.listScheduleBlocks(),
    source.listRecurrenceSeries(),
    source.listRecurrenceOccurrences(),
  ]);
  const occurrenceBySeriesAndDate = new Map(
    occurrences.map((occurrence) => [`${occurrence.seriesId}:${occurrence.occursOn}`, occurrence]),
  );
  const concreteBlocks = blocks.filter((block) => {
    if (!doesScheduleBlockOverlapDate(block, isoDate)) {
      return false;
    }
    if (block.occurrenceId !== null) {
      return occurrences.find((occurrence) => occurrence.id === block.occurrenceId)?.status !== 'cancelled';
    }

    const baseSeries = series.find((recurrence) => (
      recurrence.itemKind === 'task'
      && recurrence.itemId === block.taskItemId
      && recurrence.startsOn === block.startsAt.slice(0, 10)
    ));
    const baseException = baseSeries === undefined
      ? undefined
      : occurrenceBySeriesAndDate.get(`${baseSeries.id}:${block.startsAt.slice(0, 10)}`);
    return baseException?.status !== 'cancelled'
      && (baseException === undefined || !blocks.some((entry) => entry.occurrenceId === baseException.id));
  });
  const projectedBlocks: ScheduleBlock[] = [];

  for (const recurrence of series) {
    if (recurrence.itemKind !== 'task' || recurrence.startsOn > isoDate) {
      continue;
    }
    for (const occursOn of getRecurrenceDates(recurrence, recurrence.startsOn, isoDate)) {
      if (occursOn === recurrence.startsOn) {
        continue;
      }
      const exception = occurrenceBySeriesAndDate.get(`${recurrence.id}:${occursOn}`);
      if (exception?.status === 'cancelled') {
        continue;
      }
      if (exception !== undefined && blocks.some((block) => block.occurrenceId === exception.id)) {
        continue;
      }

      projectedBlocks.push(
        ...blocks
          .filter((block) => block.taskItemId === recurrence.itemId && block.occurrenceId === null)
          .map((block) => ({
            ...shiftBlockToOccurrence(block, recurrence, occursOn),
            occurrenceId: exception?.id ?? null,
          }))
          .filter((block) => doesScheduleBlockOverlapDate(block, isoDate)),
      );
    }
  }

  return [...concreteBlocks, ...projectedBlocks];
}

export async function saveTaskPlanning(
  source: AppDataSource,
  input: SaveTaskPlanningInput,
): Promise<SaveTaskPlanningResult> {
  const task = await getExistingTask(source, input.taskId);
  const scheduledOn = applyOptionalPatch(input.scheduledOn, task.scheduledOn);
  const periodStartOn = applyOptionalPatch(input.periodStartOn, task.periodStartOn);
  const periodEndOn = applyOptionalPatch(input.periodEndOn, task.periodEndOn);
  assertPlanningDateRange({ singleDate: scheduledOn, periodStartOn, periodEndOn });
  if (input.recurrence !== null && input.recurrence !== undefined) {
    assertRecurrenceRule(input.recurrence);
  }
  const existingBlocks = await source.listScheduleBlocks();
  const conflicts = getConflicts(input.blocks, existingBlocks);

  await source.transaction(async () => {
    await source.saveTaskItem({
      ...task,
      scheduledOn,
      periodStartOn,
      periodEndOn,
    });
    await replacePlanningRecurrence(source, 'task', task.id, input.recurrence);

    if (conflicts.length === 0) {
      for (const blockId of input.deletedBlockIds ?? []) {
        await source.deleteScheduleBlock(blockId);
      }
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
  const remindsOn = applyOptionalPatch(input.remindsOn, reminder.remindsOn);
  const periodStartOn = applyOptionalPatch(input.periodStartOn, reminder.periodStartOn);
  const periodEndOn = applyOptionalPatch(input.periodEndOn, reminder.periodEndOn);
  assertPlanningDateRange({ singleDate: remindsOn, periodStartOn, periodEndOn });
  if (input.recurrence !== null && input.recurrence !== undefined) {
    assertRecurrenceRule(input.recurrence);
  }
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
    remindsOn,
    periodStartOn,
    periodEndOn,
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
    for (const blockId of input.deletedBlockIds ?? []) {
      await source.deleteScheduleBlock(blockId);
    }
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
  const series = await source.getRecurrenceSeries(input.seriesId);
  if (series === null) {
    throw new Error('Серия повторений для экземпляра не найдена');
  }
  assertRecurrenceOccurrence(series, input.occursOn);
  if (input.taskPatch !== undefined) {
    if (series.itemKind !== 'task') {
      throw new Error('Напоминание нельзя изменить через блок задачи');
    }
    assertPlanningDateRange({
      singleDate: input.taskPatch.scheduledOn,
      periodStartOn: input.taskPatch.periodStartOn,
      periodEndOn: input.taskPatch.periodEndOn,
    });
  }
  const occurrence: RecurrenceOccurrence = {
    id: input.id,
    seriesId: input.seriesId,
    occursOn: input.occursOn,
    status: input.status,
    ...(input.taskPatch === undefined ? {} : { taskPatch: input.taskPatch }),
    createdAt: input.createdAt,
  };

  await source.transaction(async () => {
    await source.saveRecurrenceOccurrence(occurrence);
    if (input.blocks === undefined) {
      return;
    }
    if (series.itemKind !== 'task') {
      throw new Error('Напоминание не может иметь временные блоки');
    }
    const existingBlocks = await source.listScheduleBlocksForTaskItem(series.itemId);
    for (const block of existingBlocks) {
      if (block.occurrenceId === occurrence.id) {
        await source.deleteScheduleBlock(block.id);
      }
    }
    for (const block of input.blocks) {
      if (block.taskItemId !== series.itemId || block.occurrenceId !== occurrence.id) {
        throw new Error('Блок экземпляра должен принадлежать его задаче');
      }
      await source.saveScheduleBlock(block);
    }
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
    getPlanScheduleBlocks(source, isoDate),
  ]);
  return getDayLoadPercent(settings, blocks, isoDate);
}
