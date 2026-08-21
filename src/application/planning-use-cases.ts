import type { AppDataSource } from '../data/contracts';
import type { EntityId, RecurrenceSeries, ScheduleBlock } from '../domain/entities';
import { assertRecurrenceOccurrence, assertRecurrenceRule, doesScheduleBlockOverlapDate, findScheduleConflicts, getRecurrenceDates, shiftScheduleBlockToDate } from '../domain/planning';
import { assertScheduleBlockShape } from '../domain/invariants';
import { createReminder, createSubtask, createTask, updateTaskItem } from './backlog-use-cases';
import { convertReminderToTask } from './convert-reminder-to-task';
import type { CreateTimedReminderTaskWithPlanningInput, MoveRecurrenceOccurrenceInput, SaveOccurrenceExceptionInput, SaveTaskPlanningInput, SaveTaskPlanningResult, SaveTaskWithPlanningInput, ScheduleConflict } from './planning-types';

export async function getTaskPlanningSnapshot(source: AppDataSource, taskId: EntityId): Promise<{ blocks: readonly ScheduleBlock[]; recurrence: RecurrenceSeries | null }> {
  const task = await source.getTaskItem(taskId);
  if (task === null) throw new Error('Задача для планирования не найдена');
  const [blocks, series] = await Promise.all([source.listScheduleBlocksForTaskItem(taskId), source.listRecurrenceSeries()]);
  return { blocks: blocks.filter((block) => block.occurrenceId === null), recurrence: series.find((candidate) => candidate.itemKind === 'task' && candidate.itemId === taskId) ?? null };
}

function conflictList(candidates: readonly ScheduleBlock[], existing: readonly ScheduleBlock[], ignored: readonly EntityId[]): readonly ScheduleConflict[] {
  const ignoredIds = new Set([...ignored, ...candidates.map((block) => block.id)]);
  const result: ScheduleConflict[] = [];
  for (const candidate of candidates) for (const block of findScheduleConflicts(candidate, existing.filter((item) => !ignoredIds.has(item.id)))) result.push({ candidate, block });
  return result;
}

async function validateTaskPlanning(source: AppDataSource, input: SaveTaskPlanningInput) {
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
}

async function getTaskPlanningConflicts(source: AppDataSource, input: SaveTaskPlanningInput): Promise<readonly ScheduleConflict[]> {
  return conflictList(input.blocks, await source.listScheduleBlocks(), input.deletedBlockIds ?? []);
}

async function persistTaskPlanning(source: AppDataSource, input: SaveTaskPlanningInput): Promise<void> {
  for (const id of input.deletedBlockIds ?? []) await source.deleteScheduleBlock(id);
  for (const block of input.blocks) await source.saveScheduleBlock(block);
  const series = (await source.listRecurrenceSeries()).filter((candidate) => candidate.itemKind === 'task' && candidate.itemId === input.taskId);
  if (input.recurrence === null) for (const candidate of series) await source.deleteRecurrenceSeries(candidate.id);
  if (input.recurrence !== undefined && input.recurrence !== null) {
    const currentSeries = series[0];
    await source.saveRecurrenceSeries({ ...input.recurrence, id: currentSeries?.id ?? input.recurrence.id, itemKind: 'task', itemId: input.taskId, updatedAt: currentSeries?.updatedAt ?? input.recurrence.createdAt, deletedAt: null });
    for (const duplicate of series.slice(1)) await source.deleteRecurrenceSeries(duplicate.id);
  }
}

export async function saveTaskPlanning(source: AppDataSource, input: SaveTaskPlanningInput): Promise<SaveTaskPlanningResult> {
  await validateTaskPlanning(source, input);
  const conflicts = await getTaskPlanningConflicts(source, input);
  if (conflicts.length > 0 && !input.forceConflicts) return { conflict: conflicts };
  await source.transaction(async () => {
    await persistTaskPlanning(source, input);
  });
  return { conflict: null };
}

async function changeTaskProject(source: AppDataSource, taskId: EntityId, projectId: EntityId | null): Promise<void> {
  const task = await source.getTaskItem(taskId);
  if (task === null || task.kind !== 'task') throw new Error('Перемещать между проектами можно только задачу');
  if (projectId !== null) {
    const project = await source.getProject(projectId);
    if (project === null) throw new Error('Проект не найден');
    if (project.completedAt !== null) throw new Error('Нельзя добавить задачу в завершённый проект');
  }
  const related = (await source.listTaskItems()).filter((item) => item.id === task.id || item.parentTaskId === task.id);
  for (const item of related) await source.saveTaskItem({ ...item, projectId });
}

export async function saveTaskWithPlanning(source: AppDataSource, input: SaveTaskWithPlanningInput): Promise<SaveTaskPlanningResult> {
  if (input.task.id !== input.planning.taskId) throw new Error('Задача и планирование должны относиться к одному элементу');
  const conflicts = await getTaskPlanningConflicts(source, input.planning);
  if (conflicts.length > 0 && !input.planning.forceConflicts) return { conflict: conflicts };
  await source.transaction(async () => {
    if (input.task.mode === 'create') {
      if (input.task.kind === 'task') {
        await createTask(source, { id: input.task.id, title: input.task.title, description: input.task.description, projectId: input.task.projectId, estimatedDurationMinutes: input.task.estimatedDurationMinutes, createdAt: input.task.createdAt });
      } else {
        if (input.task.parentTaskId === undefined) throw new Error('Не выбрана задача-родитель');
        await createSubtask(source, { id: input.task.id, title: input.task.title, description: input.task.description, parentTaskId: input.task.parentTaskId, estimatedDurationMinutes: input.task.estimatedDurationMinutes, createdAt: input.task.createdAt });
      }
    } else {
      const current = await source.getTaskItem(input.task.id);
      if (current === null || current.kind !== input.task.kind) throw new Error('Задача не найдена');
      await updateTaskItem(source, { id: input.task.id, title: input.task.title, description: input.task.description, estimatedDurationMinutes: input.task.estimatedDurationMinutes });
      if (input.task.kind === 'task' && current.projectId !== input.task.projectId) await changeTaskProject(source, input.task.id, input.task.projectId);
    }
    await validateTaskPlanning(source, input.planning);
    await persistTaskPlanning(source, input.planning);
  });
  return { conflict: null };
}

export async function createTimedReminderTaskWithPlanning(source: AppDataSource, input: CreateTimedReminderTaskWithPlanningInput): Promise<SaveTaskPlanningResult> {
  if (input.taskId !== input.planning.taskId) throw new Error('Задача и планирование должны относиться к одному элементу');
  const conflicts = await getTaskPlanningConflicts(source, input.planning);
  if (conflicts.length > 0 && !input.planning.forceConflicts) return { conflict: conflicts };
  await source.transaction(async () => {
    await createReminder(source, input.reminder);
    await convertReminderToTask(source, { reminderId: input.reminder.id, taskId: input.taskId, createdAt: input.reminder.createdAt });
    if (input.projectId !== null) await changeTaskProject(source, input.taskId, input.projectId);
    await validateTaskPlanning(source, input.planning);
    await persistTaskPlanning(source, input.planning);
  });
  return { conflict: null };
}

export async function saveOccurrenceException(source: AppDataSource, input: SaveOccurrenceExceptionInput): Promise<void> {
  const series = await source.getRecurrenceSeries(input.occurrence.seriesId);
  if (series === null) throw new Error('Серия повторения не найдена');
  assertRecurrenceOccurrence(series, input.occurrence.occursOn);
  if (series.itemKind === 'task' && input.occurrence.reminderPatch !== null) throw new Error('Неверный тип изменения экземпляра');
  if (series.itemKind === 'reminder' && input.occurrence.taskPatch !== null) throw new Error('Неверный тип изменения экземпляра');
  await source.transaction(async () => { await persistOccurrenceException(source, input); });
}

async function persistOccurrenceException(source: AppDataSource, input: SaveOccurrenceExceptionInput): Promise<void> {
  await source.saveRecurrenceOccurrence(input.occurrence);
  if (input.blocks === undefined) return;
  const taskId = input.blocks[0]?.taskItemId;
  const prior = await source.listScheduleBlocks();
  for (const block of prior.filter((block) => block.occurrenceId === input.occurrence.id)) await source.deleteScheduleBlock(block.id);
  if (taskId === undefined) return;
  const task = await source.getTaskItem(taskId);
  if (task === null) throw new Error('Задача для блока не найдена');
  for (const block of input.blocks) { if (block.occurrenceId !== input.occurrence.id || block.taskItemId !== taskId) throw new Error('Блок должен принадлежать экземпляру'); assertScheduleBlockShape(block, task); await source.saveScheduleBlock(block); }
}

function shiftedDate(value: string, source: string, target: string): string {
  const base = new Date(`${value}T00:00:00Z`);
  const delta = new Date(`${target}T00:00:00Z`).getTime() - new Date(`${source}T00:00:00Z`).getTime();
  return new Date(base.getTime() + delta).toISOString().slice(0, 10);
}

export async function moveRecurrenceOccurrence(source: AppDataSource, input: MoveRecurrenceOccurrenceInput): Promise<{ scope: MoveRecurrenceOccurrenceInput['scope'] }> {
  const series = await source.getRecurrenceSeries(input.seriesId);
  if (series === null || series.itemKind !== 'task') throw new Error('Серия повторяющейся задачи не найдена');
  assertRecurrenceOccurrence(series, input.occursOn);
  if (input.targetDate === input.occursOn) return { scope: input.scope };
  const masterBlocks = (await source.listScheduleBlocksForTaskItem(series.itemId)).filter((block) => block.occurrenceId === null);
  if (masterBlocks.length === 0) throw new Error('У повторяющейся задачи нет временных блоков');
  const now = new Date().toISOString();
  await source.transaction(async () => {
    if (input.scope === 'series') {
      for (const block of masterBlocks) await source.saveScheduleBlock({ ...shiftScheduleBlockToDate(block, shiftedDate(block.startsAt.slice(0, 10), input.occursOn, input.targetDate)), updatedAt: now });
      await source.saveRecurrenceSeries({ ...series, startsOn: shiftedDate(series.startsOn, input.occursOn, input.targetDate), updatedAt: now });
      return;
    }
    const existing = (await source.listRecurrenceOccurrences(series.id)).find((occurrence) => occurrence.occursOn === input.occursOn);
    const occurrenceId = existing?.id ?? `occurrence-${series.id}-${input.occursOn}`;
    const occurrence = {
      id: occurrenceId,
      seriesId: series.id,
      occursOn: input.occursOn,
      cancelledAt: null,
      completedAt: existing?.completedAt ?? null,
      blocksOverridden: true,
      taskPatch: existing?.taskPatch ?? null,
      reminderPatch: null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
    };
    const blocks = masterBlocks.map((block) => ({ ...shiftScheduleBlockToDate(block, input.targetDate), id: `${occurrenceId}-${block.id}`, occurrenceId, createdAt: now, updatedAt: now, deletedAt: null }));
    await persistOccurrenceException(source, { occurrence, blocks });
  });
  return { scope: input.scope };
}

export async function setRecurrenceOccurrenceState(source: AppDataSource, seriesId: EntityId, occursOn: string, state: 'completed' | 'cancelled'): Promise<void> {
  const series = await source.getRecurrenceSeries(seriesId);
  if (series === null) throw new Error('Серия повторения не найдена');
  assertRecurrenceOccurrence(series, occursOn);
  const existing = (await source.listRecurrenceOccurrences(seriesId)).find((occurrence) => occurrence.occursOn === occursOn);
  const now = new Date().toISOString();
  await source.saveRecurrenceOccurrence({
    id: existing?.id ?? `occurrence-${seriesId}-${occursOn}`,
    seriesId,
    occursOn,
    cancelledAt: state === 'cancelled' ? now : null,
    completedAt: state === 'completed' ? now : null,
    blocksOverridden: existing?.blocksOverridden ?? false,
    taskPatch: existing?.taskPatch ?? null,
    reminderPatch: existing?.reminderPatch ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
  });
}

export async function syncReminderRecurrence(source: AppDataSource, reminderId: EntityId): Promise<void> {
  const reminder = await source.getReminder(reminderId);
  if (reminder === null) throw new Error('Напоминание не найдено');
  const current = (await source.listRecurrenceSeries()).filter((series) => series.itemKind === 'reminder' && series.itemId === reminderId);
  if (reminder.repeatRule === null || (reminder.remindsOn === null && reminder.periodStartOn === null)) { for (const series of current) await source.deleteRecurrenceSeries(series.id); return; }
  const now = new Date().toISOString();
  await source.saveRecurrenceSeries({ id: current[0]?.id ?? `series-${reminderId}`, itemKind: 'reminder', itemId: reminderId, frequency: reminder.repeatRule.frequency, interval: reminder.repeatRule.interval, startsOn: reminder.remindsOn ?? reminder.periodStartOn!, createdAt: current[0]?.createdAt ?? now, updatedAt: now, deletedAt: null });
}

export async function getPlanUntimedReminders(source: AppDataSource, isoDate: string) {
  const reminders = await source.listReminders();
  return reminders.filter((reminder) => {
    if (reminder.completedAt !== null) return false;
    const start = reminder.remindsOn ?? reminder.periodStartOn;
    if (start === null) return false;
    if (reminder.repeatRule !== null) return getRecurrenceDates({ ...reminder.repeatRule, startsOn: start }, isoDate, isoDate).includes(isoDate);
    return reminder.remindsOn === isoDate || (reminder.periodStartOn !== null && reminder.periodEndOn !== null && reminder.periodStartOn <= isoDate && isoDate <= reminder.periodEndOn);
  });
}

export async function getPlanScheduleBlocks(source: AppDataSource, isoDate: string): Promise<readonly ScheduleBlock[]> {
  const [blocks, series, tasks] = await Promise.all([source.listScheduleBlocks(), source.listRecurrenceSeries(), source.listTaskItems()]);
  const activeTaskIds = new Set(tasks.filter((task) => task.completedAt === null).map((task) => task.id));
  const recurringTaskIds = new Set(series.filter((candidate) => candidate.itemKind === 'task').map((candidate) => candidate.itemId));
  const projected: ScheduleBlock[] = blocks.filter((block) => block.occurrenceId === null && activeTaskIds.has(block.taskItemId) && !recurringTaskIds.has(block.taskItemId));
  projected.push(...blocks.filter((block) => block.occurrenceId !== null && activeTaskIds.has(block.taskItemId) && recurringTaskIds.has(block.taskItemId)));
  for (const recurring of series.filter((candidate) => candidate.itemKind === 'task')) {
    const masterBlocks = blocks.filter((block) => block.occurrenceId === null && block.taskItemId === recurring.itemId);
    if (masterBlocks.length === 0 || !getRecurrenceDates(recurring, isoDate, isoDate).includes(isoDate)) continue;
    const occurrences = await source.listRecurrenceOccurrences(recurring.id);
    const occurrence = occurrences.find((candidate) => candidate.occursOn === isoDate);
    if (occurrence !== undefined && (occurrence.cancelledAt !== null || occurrence.completedAt !== null)) continue;
    const selected = occurrence?.blocksOverridden ? [] : masterBlocks.map((block) => ({ ...shiftScheduleBlockToDate(block, isoDate, recurring.startsOn), id: `recurrence-${recurring.id}-${isoDate}-${block.id}`, occurrenceId: occurrence?.id ?? `virtual:${recurring.id}:${isoDate}` }));
    projected.push(...selected);
  }
  return projected.filter((block) => doesScheduleBlockOverlapDate(block, isoDate));
}
