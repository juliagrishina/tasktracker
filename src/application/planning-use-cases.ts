import type { AppDataSource } from '../data/contracts';
import type { EntityId, RecurrenceSeries, ScheduleBlock } from '../domain/entities';
import { assertRecurrenceOccurrence, assertRecurrenceRule, doesScheduleBlockOverlapDate, findScheduleConflicts, getRecurrenceDates, shiftScheduleBlockToDate } from '../domain/planning';
import { assertScheduleBlockShape } from '../domain/invariants';
import type { SaveOccurrenceExceptionInput, SaveTaskPlanningInput, SaveTaskPlanningResult, ScheduleConflict } from './planning-types';

function conflictList(candidates: readonly ScheduleBlock[], existing: readonly ScheduleBlock[], ignored: readonly EntityId[]): readonly ScheduleConflict[] {
  const ignoredIds = new Set([...ignored, ...candidates.map((block) => block.id)]);
  const result: ScheduleConflict[] = [];
  for (const candidate of candidates) for (const block of findScheduleConflicts(candidate, existing.filter((item) => !ignoredIds.has(item.id)))) result.push({ candidate, block });
  return result;
}

export async function saveTaskPlanning(source: AppDataSource, input: SaveTaskPlanningInput): Promise<SaveTaskPlanningResult> {
  const task = await source.getTaskItem(input.taskId);
  if (task === null) throw new Error('Задача для планирования не найдена');
  const current = await source.listScheduleBlocksForTaskItem(input.taskId);
  const currentById = new Map(current.map((block) => [block.id, block]));
  for (const block of input.blocks) {
    if (block.taskItemId !== input.taskId || block.occurrenceId !== null) throw new Error('Блок должен принадлежать планируемой задаче');
    const owner = await source.getScheduleBlock(block.id);
    if (owner !== null && owner.taskItemId !== input.taskId) throw new Error('Нельзя изменить блок другой задачи');
    assertScheduleBlockShape(block, task);
  }
  for (const id of input.deletedBlockIds ?? []) if (!currentById.has(id)) throw new Error('Нельзя удалить блок другой задачи');
  if (input.recurrence !== undefined && input.recurrence !== null) assertRecurrenceRule(input.recurrence);
  const conflicts = conflictList(input.blocks, await source.listScheduleBlocks(), input.deletedBlockIds ?? []);
  if (conflicts.length > 0) return { conflict: conflicts };
  await source.transaction(async () => {
    for (const id of input.deletedBlockIds ?? []) await source.deleteScheduleBlock(id);
    for (const block of input.blocks) await source.saveScheduleBlock(block);
    const series = (await source.listRecurrenceSeries()).filter((candidate) => candidate.itemKind === 'task' && candidate.itemId === input.taskId);
    if (input.recurrence === null) for (const candidate of series) await source.deleteRecurrenceSeries(candidate.id);
    if (input.recurrence !== undefined && input.recurrence !== null) {
      const currentSeries = series[0];
      await source.saveRecurrenceSeries({ ...input.recurrence, id: currentSeries?.id ?? input.recurrence.id, itemKind: 'task', itemId: input.taskId, updatedAt: currentSeries?.updatedAt ?? input.recurrence.createdAt, deletedAt: null });
      for (const duplicate of series.slice(1)) await source.deleteRecurrenceSeries(duplicate.id);
    }
  });
  return { conflict: null };
}

export async function saveOccurrenceException(source: AppDataSource, input: SaveOccurrenceExceptionInput): Promise<void> {
  const series = await source.getRecurrenceSeries(input.occurrence.seriesId);
  if (series === null) throw new Error('Серия повторения не найдена');
  assertRecurrenceOccurrence(series, input.occurrence.occursOn);
  if (series.itemKind === 'task' && input.occurrence.reminderPatch !== null) throw new Error('Неверный тип изменения экземпляра');
  if (series.itemKind === 'reminder' && input.occurrence.taskPatch !== null) throw new Error('Неверный тип изменения экземпляра');
  await source.transaction(async () => {
    await source.saveRecurrenceOccurrence(input.occurrence);
    if (input.blocks !== undefined) {
      const taskId = input.blocks[0]?.taskItemId;
      const prior = await source.listScheduleBlocks();
      for (const block of prior.filter((block) => block.occurrenceId === input.occurrence.id)) await source.deleteScheduleBlock(block.id);
      if (taskId !== undefined) {
        const task = await source.getTaskItem(taskId);
        if (task === null) throw new Error('Задача для блока не найдена');
        for (const block of input.blocks) { if (block.occurrenceId !== input.occurrence.id || block.taskItemId !== taskId) throw new Error('Блок должен принадлежать экземпляру'); assertScheduleBlockShape(block, task); await source.saveScheduleBlock(block); }
      }
    }
  });
}

export async function getPlanScheduleBlocks(source: AppDataSource, isoDate: string): Promise<readonly ScheduleBlock[]> {
  const [blocks, series, tasks] = await Promise.all([source.listScheduleBlocks(), source.listRecurrenceSeries(), source.listTaskItems()]);
  const activeTaskIds = new Set(tasks.filter((task) => task.completedAt === null).map((task) => task.id));
  const recurringTaskIds = new Set(series.filter((candidate) => candidate.itemKind === 'task').map((candidate) => candidate.itemId));
  const projected: ScheduleBlock[] = blocks.filter((block) => block.occurrenceId === null && activeTaskIds.has(block.taskItemId) && !recurringTaskIds.has(block.taskItemId));
  for (const recurring of series.filter((candidate) => candidate.itemKind === 'task')) {
    const masterBlocks = blocks.filter((block) => block.occurrenceId === null && block.taskItemId === recurring.itemId);
    if (masterBlocks.length === 0 || !getRecurrenceDates(recurring, isoDate, isoDate).includes(isoDate)) continue;
    const occurrences = await source.listRecurrenceOccurrences(recurring.id);
    const occurrence = occurrences.find((candidate) => candidate.occursOn === isoDate);
    if (occurrence !== undefined && (occurrence.cancelledAt !== null || occurrence.completedAt !== null)) continue;
    const exception = blocks.filter((block) => block.occurrenceId === occurrence?.id);
    const selected = occurrence?.blocksOverridden ? exception : masterBlocks.map((block) => ({ ...shiftScheduleBlockToDate(block, isoDate, recurring.startsOn), id: `recurrence-${recurring.id}-${isoDate}-${block.id}`, occurrenceId: occurrence?.id ?? null }));
    projected.push(...selected);
  }
  return projected.filter((block) => doesScheduleBlockOverlapDate(block, isoDate));
}
