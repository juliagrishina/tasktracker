import type { AppDataSource } from '../data/contracts';
import type { EntityId, RecurrenceSeries, ScheduleBlock, TaskItem } from '../domain/entities';
import { assertPlanningDateRange, assertRecurrenceOccurrence, assertRecurrenceRule, doesScheduleBlockOverlapDate, findScheduleConflicts, getRecurrenceDates, shiftScheduleBlockToDate } from '../domain/planning';
import { assertScheduleBlockShape } from '../domain/invariants';
import { createReminder, createSubtask, createTask, updateTaskItem } from './backlog-use-cases';
import { convertReminderToTask } from './convert-reminder-to-task';
import { cancelScheduleBlockNotification, type LocalNotificationScheduler, synchronizeScheduleBlockNotification } from './notification-scheduling';
import type { CreateTimedReminderTaskWithPlanningInput, MoveRecurrenceOccurrenceInput, SaveOccurrenceExceptionInput, SaveTaskPlanningInput, SaveTaskPlanningResult, SaveTaskWithPlanningInput, ScheduleConflict } from './planning-types';

export async function getTaskPlanningSnapshot(source: AppDataSource, taskId: EntityId): Promise<{ blocks: readonly ScheduleBlock[]; recurrence: RecurrenceSeries | null; placement: { scheduledOn: string | null; periodStartOn: string | null; periodEndOn: string | null } }> {
  const task = await source.getTaskItem(taskId);
  if (task === null) throw new Error('Задача для планирования не найдена');
  const [blocks, series] = await Promise.all([source.listScheduleBlocksForTaskItem(taskId), source.listRecurrenceSeries()]);
  return { blocks: blocks.filter((block) => block.occurrenceId === null), recurrence: series.find((candidate) => candidate.itemKind === 'task' && candidate.itemId === taskId) ?? null, placement: { scheduledOn: task.scheduledOn ?? null, periodStartOn: task.periodStartOn ?? null, periodEndOn: task.periodEndOn ?? null } };
}

function conflictList(candidates: readonly ScheduleBlock[], existing: readonly ScheduleBlock[], ignored: readonly EntityId[], titles: ReadonlyMap<EntityId, string>): readonly ScheduleConflict[] {
  const ignoredIds = new Set([...ignored, ...candidates.map((block) => block.id)]);
  const result: ScheduleConflict[] = [];
  for (const candidate of candidates) for (const block of findScheduleConflicts(candidate, existing.filter((item) => !ignoredIds.has(item.id)))) result.push({ candidate, block, itemTitle: titles.get(block.taskItemId) ?? 'Задача', startsAt: block.startsAt, endsAt: block.endsAt });
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
  if (input.placement !== undefined) assertPlanningDateRange({ singleDate: input.placement.scheduledOn, periodStartOn: input.placement.periodStartOn, periodEndOn: input.placement.periodEndOn });
  if (input.recurrence !== undefined && input.recurrence !== null) assertRecurrenceRule(input.recurrence);
}

async function getTaskPlanningConflicts(source: AppDataSource, input: SaveTaskPlanningInput): Promise<readonly ScheduleConflict[]> {
  const [blocks, tasks] = await Promise.all([source.listScheduleBlocks(), source.listTaskItems()]);
  return conflictList(input.blocks, blocks, input.deletedBlockIds ?? [], new Map(tasks.map((task) => [task.id, task.title])));
}

async function persistTaskPlanning(source: AppDataSource, input: SaveTaskPlanningInput, scheduler?: LocalNotificationScheduler): Promise<void> {
  for (const id of input.deletedBlockIds ?? []) {
    const current = await source.getScheduleBlock(id);
    if (current !== null && scheduler !== undefined) await cancelScheduleBlockNotification(scheduler, current);
    await source.deleteScheduleBlock(id);
  }
  const [task, settings] = await Promise.all([source.getTaskItem(input.taskId), source.getSettings()]);
  if (task === null) throw new Error('Задача для планирования не найдена');
  for (const block of input.blocks) {
    const current = await source.getScheduleBlock(block.id);
    const currentBlock = { ...block, notificationId: current?.notificationId ?? null };
    const scheduled = scheduler === undefined
      ? currentBlock
      : await synchronizeScheduleBlockNotification({ block: currentBlock, notificationLeadMinutes: settings.notificationLeadMinutes, now: new Date(), scheduler, taskTitle: task.title });
    await source.saveScheduleBlock(scheduled);
  }
  const series = (await source.listRecurrenceSeries()).filter((candidate) => candidate.itemKind === 'task' && candidate.itemId === input.taskId);
  if (input.recurrence === null) for (const candidate of series) await source.deleteRecurrenceSeries(candidate.id);
  if (input.recurrence !== undefined && input.recurrence !== null) {
    const currentSeries = series[0];
    await source.saveRecurrenceSeries({ ...input.recurrence, id: currentSeries?.id ?? input.recurrence.id, itemKind: 'task', itemId: input.taskId, updatedAt: currentSeries?.updatedAt ?? input.recurrence.createdAt, deletedAt: null });
    for (const duplicate of series.slice(1)) await source.deleteRecurrenceSeries(duplicate.id);
  }
  if (input.placement !== undefined) {
    const task = await source.getTaskItem(input.taskId);
    if (task === null) throw new Error('Задача для планирования не найдена');
    await source.saveTaskItem({ ...task, scheduledOn: input.placement.scheduledOn, periodStartOn: input.placement.periodStartOn, periodEndOn: input.placement.periodEndOn });
  }
}

export async function saveTaskPlanning(source: AppDataSource, input: SaveTaskPlanningInput, scheduler?: LocalNotificationScheduler): Promise<SaveTaskPlanningResult> {
  await validateTaskPlanning(source, input);
  const conflicts = await getTaskPlanningConflicts(source, input);
  if (conflicts.length > 0 && !input.forceConflicts) return { conflict: conflicts };
  await source.transaction(async () => {
    await persistTaskPlanning(source, input, scheduler);
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

export async function saveTaskWithPlanning(source: AppDataSource, input: SaveTaskWithPlanningInput, scheduler?: LocalNotificationScheduler): Promise<SaveTaskPlanningResult> {
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
    await persistTaskPlanning(source, input.planning, scheduler);
  });
  return { conflict: null };
}

export async function createTimedReminderTaskWithPlanning(source: AppDataSource, input: CreateTimedReminderTaskWithPlanningInput, scheduler?: LocalNotificationScheduler): Promise<SaveTaskPlanningResult> {
  if (input.taskId !== input.planning.taskId) throw new Error('Задача и планирование должны относиться к одному элементу');
  const conflicts = await getTaskPlanningConflicts(source, input.planning);
  if (conflicts.length > 0 && !input.planning.forceConflicts) return { conflict: conflicts };
  await source.transaction(async () => {
    await createReminder(source, input.reminder);
    await convertReminderToTask(source, { reminderId: input.reminder.id, taskId: input.taskId, createdAt: input.reminder.createdAt });
    if (input.projectId !== null) await changeTaskProject(source, input.taskId, input.projectId);
    const startsOn = input.reminder.remindsOn ?? input.reminder.periodStartOn;
    const recurrence = input.planning.recurrence ?? (input.reminder.repeatRule === null || startsOn === null
      ? null
      : { id: `series-${input.taskId}`, frequency: input.reminder.repeatRule.frequency, interval: input.reminder.repeatRule.interval, weekdays: input.reminder.repeatRule.weekdays, startsOn, createdAt: input.reminder.createdAt });
    const planning = { ...input.planning, recurrence };
    await validateTaskPlanning(source, planning);
    await persistTaskPlanning(source, planning, scheduler);
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
  if (series === null) throw new Error('Серия повторения не найдена');
  assertRecurrenceOccurrence(series, input.occursOn);
  if (input.targetDate === input.occursOn) return { scope: input.scope };
  const masterBlocks = series.itemKind === 'task' ? (await source.listScheduleBlocksForTaskItem(series.itemId)).filter((block) => block.occurrenceId === null) : [];
  const now = new Date().toISOString();
  await source.transaction(async () => {
    if (input.scope === 'series') {
      for (const block of masterBlocks) await source.saveScheduleBlock({ ...shiftScheduleBlockToDate(block, shiftedDate(block.startsAt.slice(0, 10), input.occursOn, input.targetDate)), updatedAt: now });
      await source.saveRecurrenceSeries({ ...series, startsOn: shiftedDate(series.startsOn, input.occursOn, input.targetDate), updatedAt: now });
      return;
    }
    const existing = (await source.listRecurrenceOccurrences(series.id)).find((occurrence) => occurrence.occursOn === input.occursOn);
    const occurrenceId = existing?.id ?? `occurrence-${series.id}-${input.occursOn}`;
    if (masterBlocks.length === 0) {
      await source.saveRecurrenceOccurrence({
        id: occurrenceId,
        seriesId: series.id,
        occursOn: input.occursOn,
        cancelledAt: now,
        completedAt: existing?.completedAt ?? null,
        blocksOverridden: false,
        taskPatch: series.itemKind === 'task' ? { ...(existing?.taskPatch ?? {}), scheduledOn: input.targetDate } : null,
        reminderPatch: series.itemKind === 'reminder' ? { ...(existing?.reminderPatch ?? {}), remindsOn: input.targetDate } : null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
      });
      return;
    }
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

export async function removeRecurrenceOccurrence(source: AppDataSource, input: { seriesId: EntityId; occursOn: string; scope: 'occurrence' | 'series' }): Promise<void> {
  const series = await source.getRecurrenceSeries(input.seriesId);
  if (series === null) throw new Error('Серия повторения не найдена');
  assertRecurrenceOccurrence(series, input.occursOn);
  if (input.scope === 'series') {
    await source.transaction(async () => { await source.deleteRecurrenceSeries(series.id); });
    return;
  }
  const existing = (await source.listRecurrenceOccurrences(series.id)).find((occurrence) => occurrence.occursOn === input.occursOn);
  if (existing !== undefined && (existing.taskPatch?.scheduledOn !== undefined || existing.reminderPatch?.remindsOn !== undefined)) {
    const now = new Date().toISOString();
    await source.saveRecurrenceOccurrence({ ...existing, cancelledAt: now, completedAt: null, taskPatch: null, reminderPatch: null, updatedAt: now });
    return;
  }
  await setRecurrenceOccurrenceState(source, series.id, input.occursOn, 'cancelled');
}

export async function syncReminderRecurrence(source: AppDataSource, reminderId: EntityId): Promise<void> {
  const reminder = await source.getReminder(reminderId);
  if (reminder === null) throw new Error('Напоминание не найдено');
  const current = (await source.listRecurrenceSeries()).filter((series) => series.itemKind === 'reminder' && series.itemId === reminderId);
  if (reminder.repeatRule === null || (reminder.remindsOn === null && reminder.periodStartOn === null)) { for (const series of current) await source.deleteRecurrenceSeries(series.id); return; }
  const now = new Date().toISOString();
  await source.saveRecurrenceSeries({ id: current[0]?.id ?? `series-${reminderId}`, itemKind: 'reminder', itemId: reminderId, frequency: reminder.repeatRule.frequency, interval: reminder.repeatRule.interval, weekdays: reminder.repeatRule.weekdays, startsOn: reminder.remindsOn ?? reminder.periodStartOn!, createdAt: current[0]?.createdAt ?? now, updatedAt: now, deletedAt: null });
}

export type PlanUntimedReminder = import('../domain/entities').Reminder & { seriesId: EntityId | null; occursOn: string | null };
export type PlanUntimedTask = TaskItem & { seriesId: EntityId | null; occursOn: string | null };

export async function getPlanUntimedReminders(source: AppDataSource, isoDate: string): Promise<readonly PlanUntimedReminder[]> {
  const [reminders, series] = await Promise.all([source.listReminders(), source.listRecurrenceSeries()]);
  const result: PlanUntimedReminder[] = [];
  for (const reminder of reminders) {
    if (reminder.completedAt !== null) continue;
    const start = reminder.remindsOn ?? reminder.periodStartOn;
    if (start === null) continue;
    const recurrence = series.find((candidate) => candidate.itemKind === 'reminder' && candidate.itemId === reminder.id);
    if (recurrence !== undefined) {
      const occurrences = await source.listRecurrenceOccurrences(recurrence.id);
      const occurrence = occurrences.find((candidate) => candidate.occursOn === isoDate);
      if (getRecurrenceDates(recurrence, isoDate, isoDate).includes(isoDate) && !(occurrence?.cancelledAt !== null && occurrence?.cancelledAt !== undefined || occurrence?.completedAt !== null && occurrence?.completedAt !== undefined)) result.push({ ...reminder, ...(occurrence?.reminderPatch ?? {}), seriesId: recurrence.id, occursOn: isoDate });
      for (const moved of occurrences.filter((candidate) => candidate.reminderPatch?.remindsOn === isoDate && candidate.completedAt === null)) result.push({ ...reminder, ...(moved.reminderPatch ?? {}), seriesId: recurrence.id, occursOn: moved.occursOn });
      continue;
    }
    if (reminder.remindsOn === isoDate || (reminder.periodStartOn !== null && reminder.periodEndOn !== null && reminder.periodStartOn <= isoDate && isoDate <= reminder.periodEndOn)) result.push({ ...reminder, seriesId: null, occursOn: null });
  }
  return result;
}

function hasPlacementOn(task: TaskItem, isoDate: string): boolean {
  return task.scheduledOn === isoDate || (task.periodStartOn !== null && task.periodStartOn !== undefined && task.periodEndOn !== null && task.periodEndOn !== undefined && task.periodStartOn <= isoDate && isoDate <= task.periodEndOn);
}

export async function getPlanUntimedTasks(source: AppDataSource, isoDate: string): Promise<readonly PlanUntimedTask[]> {
  const initialTasks = await source.listTaskItems();
  for (const task of initialTasks) if (task.completedAt === null && task.periodEndOn !== null && task.periodEndOn !== undefined && task.periodEndOn < isoDate) await returnTaskToBacklog(source, { taskId: task.id, reason: null });
  const [tasks, blocks, series] = await Promise.all([source.listTaskItems(), source.listScheduleBlocks(), source.listRecurrenceSeries()]);
  const taskIdsWithExactTime = new Set(blocks.map((block) => block.taskItemId));
  const result: PlanUntimedTask[] = [];
  for (const task of tasks) {
    if (taskIdsWithExactTime.has(task.id)) continue;
    const recurrence = series.find((candidate) => candidate.itemKind === 'task' && candidate.itemId === task.id);
    if (recurrence === undefined) {
      if (hasPlacementOn(task, isoDate)) result.push({ ...task, seriesId: null, occursOn: null });
      continue;
    }
    const occurrences = await source.listRecurrenceOccurrences(recurrence.id);
    const occurrence = occurrences.find((candidate) => candidate.occursOn === isoDate);
    if (getRecurrenceDates(recurrence, isoDate, isoDate).includes(isoDate) && !(occurrence?.cancelledAt !== null && occurrence?.cancelledAt !== undefined)) result.push({ ...task, ...(occurrence?.taskPatch ?? {}), seriesId: recurrence.id, occursOn: isoDate });
    for (const moved of occurrences.filter((candidate) => candidate.taskPatch?.scheduledOn === isoDate)) result.push({ ...task, ...(moved.taskPatch ?? {}), seriesId: recurrence.id, occursOn: moved.occursOn });
  }
  return result;
}

export async function returnTaskToBacklog(source: AppDataSource, input: { taskId: EntityId; reason: string | null }, scheduler?: LocalNotificationScheduler): Promise<void> {
  const task = await source.getTaskItem(input.taskId);
  if (task === null) throw new Error('Задача для возврата в Backlog не найдена');
  const returnedAt = new Date().toISOString();
  await source.transaction(async () => {
    await source.saveTaskItem({ ...task, scheduledOn: null, periodStartOn: null, periodEndOn: null });
    for (const block of await source.listScheduleBlocksForTaskItem(task.id)) if (new Date(block.startsAt).getTime() > new Date(returnedAt).getTime()) {
      if (scheduler !== undefined) await cancelScheduleBlockNotification(scheduler, block);
      await source.deleteScheduleBlock(block.id);
    }
    for (const series of await source.listRecurrenceSeries()) if (series.itemKind === 'task' && series.itemId === task.id) await source.deleteRecurrenceSeries(series.id);
    await source.saveTransferHistory({ id: `transfer-${task.id}-${returnedAt}`, taskItemId: task.id, reason: input.reason, returnedAt, createdAt: returnedAt });
  });
}

export async function getPlanScheduleBlocks(source: AppDataSource, isoDate: string): Promise<readonly ScheduleBlock[]> {
  const [blocks, series, tasks] = await Promise.all([source.listScheduleBlocks(), source.listRecurrenceSeries(), source.listTaskItems()]);
  const taskIds = new Set(tasks.map((task) => task.id));
  const recurringTaskIds = new Set(series.filter((candidate) => candidate.itemKind === 'task').map((candidate) => candidate.itemId));
  const projected: ScheduleBlock[] = blocks.filter((block) => block.occurrenceId === null && taskIds.has(block.taskItemId) && !recurringTaskIds.has(block.taskItemId));
  projected.push(...blocks.filter((block) => block.occurrenceId !== null && taskIds.has(block.taskItemId) && recurringTaskIds.has(block.taskItemId)));
  for (const recurring of series.filter((candidate) => candidate.itemKind === 'task')) {
    const masterBlocks = blocks.filter((block) => block.occurrenceId === null && block.taskItemId === recurring.itemId);
    if (masterBlocks.length === 0 || !getRecurrenceDates(recurring, isoDate, isoDate).includes(isoDate)) continue;
    const occurrences = await source.listRecurrenceOccurrences(recurring.id);
    const occurrence = occurrences.find((candidate) => candidate.occursOn === isoDate);
    if (occurrence !== undefined && occurrence.cancelledAt !== null) continue;
    const selected = occurrence?.blocksOverridden ? [] : masterBlocks.map((block) => ({ ...shiftScheduleBlockToDate(block, isoDate, recurring.startsOn), id: `recurrence-${recurring.id}-${isoDate}-${block.id}`, occurrenceId: occurrence?.id ?? `virtual:${recurring.id}:${isoDate}` }));
    projected.push(...selected);
  }
  return projected.filter((block) => doesScheduleBlockOverlapDate(block, isoDate));
}
