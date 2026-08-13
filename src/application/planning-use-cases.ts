import type { AppDataSource } from '../data/contracts';
import { createTaskFromReminder } from '../domain/reminder-conversion';
import { assertEstimatedDuration } from '../domain/backlog-invariants';
import { assertRecurrenceOccurrenceShape } from '../domain/invariants';
import {
  assertPlanningDateRange,
  assertRecurrenceOccurrence,
  assertRecurrenceRule,
  doesScheduleBlockOverlapDate,
  findScheduleConflicts,
  getDayLoadPercent,
  getEstimatedDurationMinutesOnDate,
  getRecurrenceDates,
  shiftScheduleBlockToDate,
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
  PlanOccurrenceContext,
  UntimedPlanEntries,
  UntimedReminderPlanEntry,
  UntimedTaskPlanEntry,
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
  deletedBlockIds: readonly EntityId[] = [],
): readonly ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const ignoredExistingIds = new Set([...candidateIds, ...deletedBlockIds]);
  const relevantExistingBlocks = existingBlocks.filter(
    (block) => !ignoredExistingIds.has(block.id),
  );

  for (const candidate of candidates) {
    const conflictsForCandidate = findScheduleConflicts(candidate, relevantExistingBlocks);
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

  const unique = new Map<string, ScheduleConflict>();
  for (const conflict of conflicts.sort(compareConflicts)) {
    const key = [conflict.candidate.id, conflict.block.id].sort().join('\u0000');
    if (!unique.has(key)) {
      unique.set(key, conflict);
    }
  }
  return [...unique.values()];
}

function applyOptionalPatch<T>(value: T | undefined, current: T): T {
  return value === undefined ? current : value;
}

function shiftBlockToOccurrence(
  block: ScheduleBlock,
  series: RecurrenceSeries,
  occursOn: string,
): ScheduleBlock {
  return {
    ...shiftScheduleBlockToDate(block, occursOn, series.startsOn),
    id: `recurrence-${series.id}-${occursOn}-${block.id}`,
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
  assertPlanningDateRange({ singleDate: isoDate, periodStartOn: null, periodEndOn: null });
  const [blocks, series, occurrences, taskItems] = await Promise.all([
    source.listScheduleBlocks(),
    source.listRecurrenceSeries(),
    source.listRecurrenceOccurrences(),
    source.listTaskItems(),
  ]);
  const activeTaskIds = new Set(
    taskItems.filter((task) => task.completedAt === null).map((task) => task.id),
  );
  const occurrenceBySeriesAndDate = new Map(
    occurrences.map((occurrence) => [`${occurrence.seriesId}:${occurrence.occursOn}`, occurrence]),
  );
  const occurrenceById = new Map(occurrences.map((occurrence) => [occurrence.id, occurrence]));
  const blocksByOccurrenceId = new Map<EntityId, ScheduleBlock[]>();
  for (const block of blocks) {
    if (block.occurrenceId === null) {
      continue;
    }
    blocksByOccurrenceId.set(
      block.occurrenceId,
      [...(blocksByOccurrenceId.get(block.occurrenceId) ?? []), block],
    );
  }
  const concreteBlocks = blocks.filter((block) => {
    if (!activeTaskIds.has(block.taskItemId)) {
      return false;
    }
    if (!doesScheduleBlockOverlapDate(block, isoDate)) {
      return false;
    }
    if (block.occurrenceId !== null) {
      return occurrenceById.get(block.occurrenceId)?.status === 'active';
    }

    const baseSeries = series.find((recurrence) => (
      recurrence.itemKind === 'task'
      && recurrence.itemId === block.taskItemId
    ));
    const baseException = baseSeries === undefined
      ? undefined
      : occurrenceBySeriesAndDate.get(`${baseSeries.id}:${baseSeries.startsOn}`);
    return baseException === undefined
      || (
        baseException.status === 'active'
        && baseException.taskPatch === undefined
        && (blocksByOccurrenceId.get(baseException.id)?.length ?? 0) === 0
      );
  });
  const projectedBlocks: ScheduleBlock[] = [];

  for (const recurrence of series) {
    if (
      recurrence.itemKind !== 'task'
      || !activeTaskIds.has(recurrence.itemId)
      || recurrence.startsOn > isoDate
    ) {
      continue;
    }
    for (const occursOn of getRecurrenceDates(recurrence, recurrence.startsOn, isoDate)) {
      if (occursOn === recurrence.startsOn) {
        continue;
      }
      const exception = occurrenceBySeriesAndDate.get(`${recurrence.id}:${occursOn}`);
      if (exception !== undefined && exception.status !== 'active') {
        continue;
      }
      if (
        exception?.taskPatch !== undefined
        || (exception !== undefined && (blocksByOccurrenceId.get(exception.id)?.length ?? 0) > 0)
      ) {
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
  const estimatedDurationMinutes = applyOptionalPatch(
    input.estimatedDurationMinutes,
    task.estimatedDurationMinutes,
  );
  assertPlanningDateRange({ singleDate: scheduledOn, periodStartOn, periodEndOn });
  assertEstimatedDuration(estimatedDurationMinutes);
  if (input.recurrence !== null && input.recurrence !== undefined) {
    assertRecurrenceRule(input.recurrence);
  }
  const existingBlocks = await source.listScheduleBlocks();
  const conflicts = getConflicts(input.blocks, existingBlocks, input.deletedBlockIds);

  await source.transaction(async () => {
    await source.saveTaskItem({
      ...task,
      scheduledOn,
      periodStartOn,
      periodEndOn,
      estimatedDurationMinutes,
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
  const estimatedDurationMinutes = applyOptionalPatch(
    input.estimatedDurationMinutes,
    reminder.estimatedDurationMinutes,
  );
  assertPlanningDateRange({ singleDate: remindsOn, periodStartOn, periodEndOn });
  assertEstimatedDuration(estimatedDurationMinutes);
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
    estimatedDurationMinutes,
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
  if (input.taskPatch !== undefined && input.reminderPatch !== undefined) {
    throw new Error('Экземпляр не может одновременно содержать патч задачи и напоминания');
  }
  if (input.taskPatch !== undefined) {
    if (series.itemKind !== 'task') {
      throw new Error('Напоминание нельзя изменить через блок задачи');
    }
    assertPlanningDateRange({
      singleDate: input.taskPatch.scheduledOn,
      periodStartOn: input.taskPatch.periodStartOn,
      periodEndOn: input.taskPatch.periodEndOn,
    });
    assertEstimatedDuration(input.taskPatch.estimatedDurationMinutes);
  }
  if (input.reminderPatch !== undefined) {
    if (series.itemKind !== 'reminder') {
      throw new Error('Патч напоминания нельзя применить к серии задачи');
    }
    assertPlanningDateRange({
      singleDate: input.reminderPatch.remindsOn,
      periodStartOn: input.reminderPatch.periodStartOn,
      periodEndOn: input.reminderPatch.periodEndOn,
    });
    assertEstimatedDuration(input.reminderPatch.estimatedDurationMinutes);
  }
  if (input.blocks !== undefined) {
    if (series.itemKind !== 'task') {
      throw new Error('Напоминание не может иметь временные блоки');
    }
    for (const block of input.blocks) {
      if (block.taskItemId !== series.itemId || block.occurrenceId !== input.id) {
        throw new Error('Блок экземпляра должен принадлежать его задаче');
      }
    }
  }
  const occurrence: RecurrenceOccurrence = {
    id: input.id,
    seriesId: input.seriesId,
    occursOn: input.occursOn,
    status: input.status,
    completedAt: input.status === 'completed' ? input.completedAt ?? null : null,
    ...(input.taskPatch === undefined ? {} : { taskPatch: input.taskPatch }),
    ...(input.reminderPatch === undefined ? {} : { reminderPatch: input.reminderPatch }),
    createdAt: input.createdAt,
  };
  assertRecurrenceOccurrenceShape(occurrence);

  await source.transaction(async () => {
    await source.saveRecurrenceOccurrence(occurrence);
    if (input.blocks === undefined) {
      return;
    }
    const existingBlocks = await source.listScheduleBlocksForTaskItem(series.itemId);
    for (const block of existingBlocks) {
      if (block.occurrenceId === occurrence.id) {
        await source.deleteScheduleBlock(block.id);
      }
    }
    for (const block of input.blocks) {
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

type TaskPlanningDates = Pick<TaskItem, 'scheduledOn' | 'periodStartOn' | 'periodEndOn'>;
type ReminderPlanningDates = Pick<Reminder, 'remindsOn' | 'periodStartOn' | 'periodEndOn'>;

interface UntimedTaskProjection {
  entry: UntimedTaskPlanEntry;
  estimatedMinutes: number;
}

interface UntimedReminderProjection {
  entry: UntimedReminderPlanEntry;
  estimatedMinutes: number;
}

interface UntimedPlanProjection {
  tasks: readonly UntimedTaskProjection[];
  reminders: readonly UntimedReminderProjection[];
}

function getPlanningDateRange(
  item: TaskPlanningDates | ReminderPlanningDates,
): { singleDate: string | null; periodStartOn: string | null; periodEndOn: string | null } {
  return {
    singleDate: 'scheduledOn' in item ? item.scheduledOn : item.remindsOn,
    periodStartOn: item.periodStartOn,
    periodEndOn: item.periodEndOn,
  };
}

function hasExplicitPlanningDate(item: TaskPlanningDates | ReminderPlanningDates): boolean {
  const range = getPlanningDateRange(item);
  return range.singleDate !== null
    || (range.periodStartOn !== null && range.periodEndOn !== null);
}

function matchesPlanningDate(
  item: TaskPlanningDates | ReminderPlanningDates,
  isoDate: string,
): boolean {
  const range = getPlanningDateRange(item);
  return range.singleDate === isoDate
    || (
      range.periodStartOn !== null
      && range.periodEndOn !== null
      && range.periodStartOn <= isoDate
      && isoDate <= range.periodEndOn
    );
}

function toOccurrenceContext(
  series: RecurrenceSeries,
  occursOn: string,
  occurrence?: RecurrenceOccurrence,
): PlanOccurrenceContext {
  return {
    id: occurrence?.id ?? `occurrence-${series.id}-${occursOn}`,
    seriesId: series.id,
    occursOn,
    frequency: series.frequency,
    interval: series.interval,
    startsOn: series.startsOn,
  };
}

function selectUntimedPlanProjection(
  taskItems: readonly TaskItem[],
  reminders: readonly Reminder[],
  recurrenceSeries: readonly RecurrenceSeries[],
  occurrences: readonly RecurrenceOccurrence[],
  isoDate: string,
): UntimedPlanProjection {
  assertPlanningDateRange({ singleDate: isoDate, periodStartOn: null, periodEndOn: null });
  const occurrencesBySeries = new Map<EntityId, RecurrenceOccurrence[]>();
  for (const occurrence of occurrences) {
    occurrencesBySeries.set(
      occurrence.seriesId,
      [...(occurrencesBySeries.get(occurrence.seriesId) ?? []), occurrence],
    );
  }

  const taskProjections = new Map<string, UntimedTaskProjection>();
  for (const task of taskItems.filter((item) => item.completedAt === null)) {
    const itemSeries = recurrenceSeries.filter((series) => (
      series.itemKind === 'task' && series.itemId === task.id
    ));
    if (itemSeries.length === 0) {
      if (matchesPlanningDate(task, isoDate)) {
        taskProjections.set(`task:${task.id}`, {
          entry: task,
          estimatedMinutes: getEstimatedDurationMinutesOnDate(
            task.estimatedDurationMinutes,
            getPlanningDateRange(task),
            isoDate,
          ),
        });
      }
      continue;
    }

    for (const series of itemSeries) {
      const seriesOccurrences = occurrencesBySeries.get(series.id) ?? [];
      const generatedOccursOn = getRecurrenceDates(series, isoDate, isoDate)[0];
      const addOccurrence = (occursOn: string, savedOccurrence?: RecurrenceOccurrence): void => {
        if (savedOccurrence !== undefined && savedOccurrence.status !== 'active') {
          return;
        }
        const patch = savedOccurrence?.taskPatch;
        const usesPatchedSchedule = patch !== undefined && hasExplicitPlanningDate(patch);
        if (usesPatchedSchedule ? !matchesPlanningDate(patch, isoDate) : occursOn !== isoDate) {
          return;
        }
        const entry = {
          ...task,
          ...(patch ?? {}),
          occurrence: toOccurrenceContext(series, occursOn, savedOccurrence),
        } as UntimedTaskPlanEntry;
        const range = usesPatchedSchedule
          ? getPlanningDateRange(patch)
          : { singleDate: isoDate, periodStartOn: null, periodEndOn: null };
        taskProjections.set(`${series.id}:${occursOn}`, {
          entry,
          estimatedMinutes: getEstimatedDurationMinutesOnDate(
            entry.estimatedDurationMinutes,
            range,
            isoDate,
          ),
        });
      };

      if (generatedOccursOn !== undefined) {
        addOccurrence(
          generatedOccursOn,
          seriesOccurrences.find((occurrence) => occurrence.occursOn === generatedOccursOn),
        );
      }
      for (const occurrence of seriesOccurrences) {
        if (
          occurrence.status === 'active'
          && occurrence.taskPatch !== undefined
          && hasExplicitPlanningDate(occurrence.taskPatch)
          && matchesPlanningDate(occurrence.taskPatch, isoDate)
        ) {
          addOccurrence(occurrence.occursOn, occurrence);
        }
      }
    }
  }

  const reminderProjections = new Map<string, UntimedReminderProjection>();
  for (const reminder of reminders.filter((item) => item.completedAt === null)) {
    const itemSeries = recurrenceSeries.filter((series) => (
      series.itemKind === 'reminder' && series.itemId === reminder.id
    ));
    if (itemSeries.length === 0) {
      if (matchesPlanningDate(reminder, isoDate)) {
        reminderProjections.set(`reminder:${reminder.id}`, {
          entry: reminder,
          estimatedMinutes: getEstimatedDurationMinutesOnDate(
            reminder.estimatedDurationMinutes,
            getPlanningDateRange(reminder),
            isoDate,
          ),
        });
      }
      continue;
    }

    for (const series of itemSeries) {
      const seriesOccurrences = occurrencesBySeries.get(series.id) ?? [];
      const generatedOccursOn = getRecurrenceDates(series, isoDate, isoDate)[0];
      const addOccurrence = (occursOn: string, savedOccurrence?: RecurrenceOccurrence): void => {
        if (savedOccurrence !== undefined && savedOccurrence.status !== 'active') {
          return;
        }
        const patch = savedOccurrence?.reminderPatch;
        const usesPatchedSchedule = patch !== undefined && hasExplicitPlanningDate(patch);
        if (usesPatchedSchedule ? !matchesPlanningDate(patch, isoDate) : occursOn !== isoDate) {
          return;
        }
        const entry = {
          ...reminder,
          ...(patch ?? {}),
          occurrence: toOccurrenceContext(series, occursOn, savedOccurrence),
        } as UntimedReminderPlanEntry;
        const range = usesPatchedSchedule
          ? getPlanningDateRange(patch)
          : { singleDate: isoDate, periodStartOn: null, periodEndOn: null };
        reminderProjections.set(`${series.id}:${occursOn}`, {
          entry,
          estimatedMinutes: getEstimatedDurationMinutesOnDate(
            entry.estimatedDurationMinutes,
            range,
            isoDate,
          ),
        });
      };

      if (generatedOccursOn !== undefined) {
        addOccurrence(
          generatedOccursOn,
          seriesOccurrences.find((occurrence) => occurrence.occursOn === generatedOccursOn),
        );
      }
      for (const occurrence of seriesOccurrences) {
        if (
          occurrence.status === 'active'
          && occurrence.reminderPatch !== undefined
          && hasExplicitPlanningDate(occurrence.reminderPatch)
          && matchesPlanningDate(occurrence.reminderPatch, isoDate)
        ) {
          addOccurrence(occurrence.occursOn, occurrence);
        }
      }
    }
  }

  return {
    tasks: [...taskProjections.values()].sort(
      (left, right) => left.entry.createdAt.localeCompare(right.entry.createdAt),
    ),
    reminders: [...reminderProjections.values()].sort(
      (left, right) => left.entry.createdAt.localeCompare(right.entry.createdAt),
    ),
  };
}

function taskProjectionHasExactBlock(
  projection: UntimedTaskProjection,
  blocks: readonly ScheduleBlock[],
): boolean {
  const occurrence = projection.entry.occurrence;
  if (occurrence === undefined) {
    return blocks.some((block) => block.taskItemId === projection.entry.id);
  }

  const projectedIdPrefix = `recurrence-${occurrence.seriesId}-${occurrence.occursOn}-`;
  return blocks.some((block) => (
    block.taskItemId === projection.entry.id
    && (
      block.occurrenceId === occurrence.id
      || block.id.startsWith(projectedIdPrefix)
      || (
        occurrence.occursOn === occurrence.startsOn
        && block.occurrenceId === null
        && !block.id.startsWith('recurrence-')
      )
    )
  ));
}

export async function getUntimedPlanEntries(
  source: AppDataSource,
  isoDate: string,
  selectedDayBlocks?: readonly ScheduleBlock[],
): Promise<UntimedPlanEntries> {
  const [taskItems, reminders, recurrenceSeries, occurrences, blocks] = await Promise.all([
    source.listTaskItems(),
    source.listReminders(),
    source.listRecurrenceSeries(),
    source.listRecurrenceOccurrences(),
    selectedDayBlocks === undefined ? getPlanScheduleBlocks(source, isoDate) : selectedDayBlocks,
  ]);
  const projection = selectUntimedPlanProjection(
    taskItems,
    reminders,
    recurrenceSeries,
    occurrences,
    isoDate,
  );
  return {
    tasks: projection.tasks
      .filter((entry) => !taskProjectionHasExactBlock(entry, blocks))
      .map(({ entry }) => entry),
    reminders: projection.reminders.map(({ entry }) => entry),
  };
}

export async function getPlanLoad(
  source: AppDataSource,
  isoDate: string,
): Promise<number> {
  const [settings, blocks, taskItems, reminders, recurrenceSeries, occurrences] = await Promise.all([
    source.getSettings(),
    getPlanScheduleBlocks(source, isoDate),
    source.listTaskItems(),
    source.listReminders(),
    source.listRecurrenceSeries(),
    source.listRecurrenceOccurrences(),
  ]);
  const projection = selectUntimedPlanProjection(
    taskItems,
    reminders,
    recurrenceSeries,
    occurrences,
    isoDate,
  );
  const estimatedMinutes = projection.tasks
    .filter((entry) => !taskProjectionHasExactBlock(entry, blocks))
    .reduce((total, entry) => total + entry.estimatedMinutes, 0)
    + projection.reminders.reduce((total, entry) => total + entry.estimatedMinutes, 0);
  return getDayLoadPercent(settings, blocks, isoDate, estimatedMinutes);
}
