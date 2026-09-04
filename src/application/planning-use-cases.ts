import type { AppDataSource } from '../data/contracts';
import type { EntityId, RecurrenceBlockTemplate, RecurrenceSeries, RecurrenceTaskPatch, Reminder, ScheduleBlock, TaskItem } from '../domain/entities';
import { assertPlanningDateRange, assertRecurrenceOccurrence, assertRecurrenceRule, doesScheduleBlockOverlapDate, findScheduleConflicts, getDateInTimeZone, getRecurrenceDates, shiftScheduleBlockToDate } from '../domain/planning';
import { assertScheduleBlockShape } from '../domain/invariants';
import { createUuid, stableLegacyUuid } from '../domain/uuid';
import { createReminder, createSubtask, createTask, updateTaskItem } from './backlog-use-cases';
import { convertReminderToTask } from './convert-reminder-to-task';
import { cancelScheduleBlockNotification, type LocalNotificationScheduler, synchronizeScheduleBlockNotification } from './notification-scheduling';
import type { CreateTimedReminderTaskWithPlanningInput, MoveRecurrenceOccurrenceInput, SaveOccurrenceExceptionInput, SaveRecurrenceRevisionInput, SaveTaskPlanningInput, SaveTaskPlanningResult, SaveTaskWithPlanningInput, ScheduleConflict } from './planning-types';

interface EffectiveTaskRecurrence {
  rule: RecurrenceSeries;
  taskPatch: RecurrenceTaskPatch;
  blockTemplates: readonly RecurrenceBlockTemplate[] | null;
}

async function getEffectiveTaskRecurrence(source: AppDataSource, series: RecurrenceSeries, isoDate: string): Promise<EffectiveTaskRecurrence | null> {
  if (series.itemKind !== 'task' || isoDate < series.startsOn) return null;
  const revisions = await source.listRecurrenceRevisions(series.id);
  const revision = revisions.filter((candidate) => candidate.effectiveFrom <= isoDate).at(-1);
  if (revision === undefined) return { rule: series, taskPatch: {}, blockTemplates: null };
  return {
    rule: { ...series, frequency: revision.frequency, interval: revision.interval, weekdays: revision.weekdays, startsOn: revision.effectiveFrom },
    taskPatch: revision.taskPatch,
    blockTemplates: revision.blockTemplates,
  };
}

async function assertTaskRecurrenceOccurrence(source: AppDataSource, series: RecurrenceSeries, occursOn: string): Promise<void> {
  const effective = await getEffectiveTaskRecurrence(source, series, occursOn);
  if (effective === null || !getRecurrenceDates(effective.rule, occursOn, occursOn).includes(occursOn)) throw new Error('Экземпляр не принадлежит серии повторения');
}

function toBlockTemplates(blocks: readonly ScheduleBlock[]): readonly RecurrenceBlockTemplate[] {
  return blocks.map(({ timeZoneId, startsAt, endsAt }) => ({ timeZoneId, startsAt, endsAt }));
}

function fromBlockTemplates(templates: readonly RecurrenceBlockTemplate[], taskItemId: EntityId, now: string): readonly ScheduleBlock[] {
  return templates.map((template, index) => ({
    id: stableLegacyUuid('schedule_blocks', `${taskItemId}:${template.startsAt}:${template.endsAt}:${index}`),
    taskItemId,
    occurrenceId: null,
    timeZoneId: template.timeZoneId,
    startsAt: template.startsAt,
    endsAt: template.endsAt,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));
}

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
      : await synchronizeScheduleBlockNotification({ block: currentBlock, displayTimeZoneId: settings.timeZoneId, notificationLeadMinutes: settings.notificationLeadMinutes, now: new Date(), scheduler, taskTitle: task.title });
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
  if (scheduler !== undefined) await synchronizeRecurrenceNotifications(source, scheduler, new Date());
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
  if (scheduler !== undefined) await synchronizeRecurrenceNotifications(source, scheduler, new Date());
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
      : { id: createUuid(), frequency: input.reminder.repeatRule.frequency, interval: input.reminder.repeatRule.interval, weekdays: input.reminder.repeatRule.weekdays, startsOn, createdAt: input.reminder.createdAt });
    const planning = { ...input.planning, recurrence };
    await validateTaskPlanning(source, planning);
    await persistTaskPlanning(source, planning, scheduler);
  });
  if (scheduler !== undefined) await synchronizeRecurrenceNotifications(source, scheduler, new Date());
  return { conflict: null };
}

export async function saveOccurrenceException(source: AppDataSource, input: SaveOccurrenceExceptionInput, scheduler?: LocalNotificationScheduler): Promise<void> {
  const series = await source.getRecurrenceSeries(input.occurrence.seriesId);
  if (series === null) throw new Error('Серия повторения не найдена');
  if (series.itemKind === 'task') await assertTaskRecurrenceOccurrence(source, series, input.occurrence.occursOn);
  else assertRecurrenceOccurrence(series, input.occurrence.occursOn);
  if (series.itemKind === 'task' && input.occurrence.reminderPatch !== null) throw new Error('Неверный тип изменения экземпляра');
  if (series.itemKind === 'reminder' && input.occurrence.taskPatch !== null) throw new Error('Неверный тип изменения экземпляра');
  await source.transaction(async () => { await persistOccurrenceException(source, input, scheduler); });
  if (scheduler !== undefined) await synchronizeRecurrenceNotifications(source, scheduler, new Date());
}

/** Saves a forward-only revision. The base series remains intact for all earlier calendar dates. */
export async function saveRecurrenceRevision(source: AppDataSource, input: SaveRecurrenceRevisionInput, scheduler?: LocalNotificationScheduler): Promise<void> {
  const series = await source.getRecurrenceSeries(input.seriesId);
  if (series === null || series.itemKind !== 'task') throw new Error('Серия задачи не найдена');
  const task = await source.getTaskItem(series.itemId);
  if (task === null) throw new Error('Задача для серии не найдена');
  if (input.effectiveFrom < series.startsOn) throw new Error('Изменение серии не может начинаться раньше её первого экземпляра');
  if (input.recurrence.startsOn !== input.effectiveFrom) throw new Error('Дата начала изменения серии должна совпадать с датой первого обновлённого экземпляра');
  assertRecurrenceRule(input.recurrence);
  for (const block of input.blocks) {
    if (block.taskItemId !== task.id || block.occurrenceId !== null) throw new Error('Шаблон блока должен принадлежать серии задачи');
    assertScheduleBlockShape(block, task);
  }
  const now = new Date().toISOString();
  const existing = (await source.listRecurrenceRevisions(series.id)).find((revision) => revision.effectiveFrom === input.effectiveFrom);
  await source.transaction(async () => {
    await source.saveRecurrenceRevision({
      id: existing?.id ?? stableLegacyUuid('recurrence_revisions', `${series.id}:${input.effectiveFrom}`),
      seriesId: series.id,
      effectiveFrom: input.effectiveFrom,
      frequency: input.recurrence.frequency,
      interval: input.recurrence.interval,
      weekdays: input.recurrence.weekdays,
      taskPatch: input.taskPatch,
      blockTemplates: toBlockTemplates(input.blocks),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
    });
  });
  if (scheduler !== undefined) await synchronizeRecurrenceNotifications(source, scheduler, new Date());
}

async function persistOccurrenceException(source: AppDataSource, input: SaveOccurrenceExceptionInput, scheduler?: LocalNotificationScheduler): Promise<void> {
  await source.saveRecurrenceOccurrence(input.occurrence);
  if (input.blocks === undefined) return;
  const taskId = input.blocks[0]?.taskItemId;
  const prior = await source.listScheduleBlocks();
  for (const block of prior.filter((block) => block.occurrenceId === input.occurrence.id)) {
    if (scheduler !== undefined) await cancelScheduleBlockNotification(scheduler, block);
    await source.deleteScheduleBlock(block.id);
  }
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

export async function moveRecurrenceOccurrence(source: AppDataSource, input: MoveRecurrenceOccurrenceInput, scheduler?: LocalNotificationScheduler): Promise<{ scope: MoveRecurrenceOccurrenceInput['scope'] }> {
  const series = await source.getRecurrenceSeries(input.seriesId);
  if (series === null) throw new Error('Серия повторения не найдена');
  if (series.itemKind === 'task') await assertTaskRecurrenceOccurrence(source, series, input.occursOn);
  else assertRecurrenceOccurrence(series, input.occursOn);
  if (input.targetDate === input.occursOn) return { scope: input.scope };
  const effective = series.itemKind === 'task' ? await getEffectiveTaskRecurrence(source, series, input.occursOn) : null;
  const masterBlocks = series.itemKind === 'task'
    ? effective?.blockTemplates === null
      ? (await source.listScheduleBlocksForTaskItem(series.itemId)).filter((block) => block.occurrenceId === null)
      : effective === null ? [] : fromBlockTemplates(effective.blockTemplates, series.itemId, series.createdAt)
    : [];
  const now = new Date().toISOString();
  await source.transaction(async () => {
    if (input.scope === 'series') {
      for (const block of masterBlocks) await source.saveScheduleBlock({ ...shiftScheduleBlockToDate(block, shiftedDate(getDateInTimeZone(block.startsAt, block.timeZoneId), input.occursOn, input.targetDate)), updatedAt: now });
      await source.saveRecurrenceSeries({ ...series, startsOn: shiftedDate(series.startsOn, input.occursOn, input.targetDate), updatedAt: now });
      return;
    }
    const existing = (await source.listRecurrenceOccurrences(series.id)).find((occurrence) => occurrence.occursOn === input.occursOn);
    const occurrenceId = existing?.id ?? stableLegacyUuid('recurrence_occurrences', `${series.id}:${input.occursOn}`);
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
    const blocks = masterBlocks.map((block) => ({ ...shiftScheduleBlockToDate(block, input.targetDate), id: stableLegacyUuid('schedule_blocks', `${occurrenceId}:${block.id}`), occurrenceId, createdAt: now, updatedAt: now, deletedAt: null }));
    await persistOccurrenceException(source, { occurrence, blocks }, scheduler);
  });
  if (scheduler !== undefined) await synchronizeRecurrenceNotifications(source, scheduler, new Date());
  return { scope: input.scope };
}

export async function setRecurrenceOccurrenceState(source: AppDataSource, seriesId: EntityId, occursOn: string, state: 'active' | 'completed' | 'cancelled', scheduler?: LocalNotificationScheduler, now = new Date()): Promise<void> {
  const series = await source.getRecurrenceSeries(seriesId);
  if (series === null) throw new Error('Серия повторения не найдена');
  if (series.itemKind === 'task') await assertTaskRecurrenceOccurrence(source, series, occursOn);
  else assertRecurrenceOccurrence(series, occursOn);
  const existing = (await source.listRecurrenceOccurrences(seriesId)).find((occurrence) => occurrence.occursOn === occursOn);
  const updatedAt = now.toISOString();
  await source.saveRecurrenceOccurrence({
    id: existing?.id ?? stableLegacyUuid('recurrence_occurrences', `${seriesId}:${occursOn}`),
    seriesId,
    occursOn,
    cancelledAt: state === 'cancelled' ? updatedAt : null,
    completedAt: state === 'completed' ? updatedAt : null,
    blocksOverridden: existing?.blocksOverridden ?? false,
    taskPatch: existing?.taskPatch ?? null,
    reminderPatch: existing?.reminderPatch ?? null,
    createdAt: existing?.createdAt ?? updatedAt,
    updatedAt,
    deletedAt: null,
    notificationIds: existing?.notificationIds ?? [],
  });
  if (scheduler !== undefined) await synchronizeRecurrenceNotifications(source, scheduler, now);
}

export interface UnfinishedTaskActionInput {
  taskId: EntityId;
  occurrence: { seriesId: EntityId; occursOn: string } | null;
  now?: Date;
}

function withThirtyMoreMinutes(block: ScheduleBlock, updatedAt: string): ScheduleBlock {
  return { ...block, endsAt: new Date(new Date(block.endsAt).getTime() + 30 * 60_000).toISOString(), updatedAt };
}

async function synchronizeBlocks(source: AppDataSource, task: TaskItem, blocks: readonly ScheduleBlock[], now: Date, scheduler: LocalNotificationScheduler | undefined): Promise<readonly ScheduleBlock[]> {
  if (scheduler === undefined) return blocks;
  const settings = await source.getSettings();
  return Promise.all(blocks.map((block) => synchronizeScheduleBlockNotification({ block, displayTimeZoneId: settings.timeZoneId, notificationLeadMinutes: settings.notificationLeadMinutes, now, scheduler, taskTitle: task.title })));
}

const recurrenceNotificationHorizonDays = 90;

function addCalendarDays(isoDate: string, days: number): string {
  const value = new Date(`${isoDate}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function cancelOccurrenceNotifications(source: AppDataSource, scheduler: LocalNotificationScheduler): Promise<void> {
  const [series, blocks] = await Promise.all([source.listRecurrenceSeries(), source.listScheduleBlocks()]);
  for (const block of blocks.filter((candidate) => candidate.occurrenceId !== null || series.some((recurrence) => recurrence.itemKind === 'task' && recurrence.itemId === candidate.taskItemId))) {
    await cancelScheduleBlockNotification(scheduler, block);
    if (block.notificationId !== null && block.notificationId !== undefined) await source.saveScheduleBlock({ ...block, notificationId: null });
  }
  for (const recurrence of series) {
    for (const occurrence of await source.listRecurrenceOccurrences(recurrence.id)) {
      for (const notificationId of occurrence.notificationIds ?? []) await scheduler.cancel(notificationId);
      if ((occurrence.notificationIds?.length ?? 0) > 0) await source.saveRecurrenceOccurrence({ ...occurrence, notificationIds: [] });
    }
  }
}

/**
 * Native notifications cannot safely represent an unbounded custom recurrence.
 * Store concrete notifications only in the next 90 days and rebuild them on startup
 * and after every change to a recurrence series or occurrence.
 */
export async function synchronizeRecurrenceNotifications(source: AppDataSource, scheduler: LocalNotificationScheduler, now = new Date()): Promise<void> {
  const [settings, series, allBlocks] = await Promise.all([source.getSettings(), source.listRecurrenceSeries(), source.listScheduleBlocks()]);
  const fromDate = getDateInTimeZone(now.toISOString(), settings.timeZoneId);
  const untilDate = addCalendarDays(fromDate, recurrenceNotificationHorizonDays);
  await cancelOccurrenceNotifications(source, scheduler);

  for (const recurrence of series.filter((candidate) => candidate.itemKind === 'task')) {
    const task = await source.getTaskItem(recurrence.itemId);
    if (task === null || task.completedAt !== null) continue;
    const occurrences = await source.listRecurrenceOccurrences(recurrence.id);
    const byDate = new Map(occurrences.map((occurrence) => [occurrence.occursOn, occurrence]));
    for (let occursOn = fromDate; occursOn <= untilDate; occursOn = addCalendarDays(occursOn, 1)) {
      const effective = await getEffectiveTaskRecurrence(source, recurrence, occursOn);
      if (effective === null || !getRecurrenceDates(effective.rule, occursOn, occursOn).includes(occursOn)) continue;
      const existing = byDate.get(occursOn);
      if (existing?.cancelledAt !== null && existing?.cancelledAt !== undefined || existing?.completedAt !== null && existing?.completedAt !== undefined) continue;
      const occurrenceId = existing?.id ?? stableLegacyUuid('recurrence_occurrences', `${recurrence.id}:${occursOn}`);
      const masterBlocks = effective.blockTemplates === null
        ? allBlocks.filter((block) => block.taskItemId === task.id && block.occurrenceId === null)
        : fromBlockTemplates(effective.blockTemplates, task.id, recurrence.createdAt);
      if (masterBlocks.length === 0) continue;
      const blocks = existing?.blocksOverridden
        ? (await source.listScheduleBlocks()).filter((block) => block.occurrenceId === occurrenceId)
        : masterBlocks.map((block) => ({ ...shiftScheduleBlockToDate(block, occursOn), id: stableLegacyUuid('schedule_blocks', `${occurrenceId}:${block.id}`), occurrenceId, notificationId: null }));
      const notificationTask = { ...task, ...effective.taskPatch };
      const scheduled = await synchronizeBlocks(source, notificationTask, blocks.map((block) => ({ ...block, notificationId: null })), now, scheduler);
      const notificationIds = scheduled.map((block) => block.notificationId).filter((id): id is string => id !== null && id !== undefined);
      await source.saveRecurrenceOccurrence({
        id: occurrenceId,
        seriesId: recurrence.id,
        occursOn,
        cancelledAt: existing?.cancelledAt ?? null,
        completedAt: existing?.completedAt ?? null,
        blocksOverridden: existing?.blocksOverridden ?? false,
        taskPatch: existing?.taskPatch ?? null,
        reminderPatch: existing?.reminderPatch ?? null,
        createdAt: existing?.createdAt ?? now.toISOString(),
        updatedAt: now.toISOString(),
        deletedAt: existing?.deletedAt ?? null,
        notificationIds,
      });
    }
  }
}

export async function continueIncompleteTask(source: AppDataSource, input: UnfinishedTaskActionInput, scheduler?: LocalNotificationScheduler): Promise<void> {
  const task = await source.getTaskItem(input.taskId);
  if (task === null) throw new Error('Задача для продолжения не найдена');
  const actionTime = input.now ?? new Date();
  const updatedAt = actionTime.toISOString();

  if (input.occurrence === null) {
    const blocks = (await source.listScheduleBlocksForTaskItem(task.id)).filter((block) => block.occurrenceId === null);
    const latest = blocks.reduce<ScheduleBlock | null>((result, block) => result === null || new Date(block.endsAt).getTime() > new Date(result.endsAt).getTime() ? block : result, null);
    if (latest === null) throw new Error('Для задачи нет блока, который можно продлить');
    const extended = await synchronizeBlocks(source, task, [withThirtyMoreMinutes(latest, updatedAt)], actionTime, scheduler);
    await source.saveScheduleBlock(extended[0]!);
    return;
  }

  const series = await source.getRecurrenceSeries(input.occurrence.seriesId);
  if (series === null || series.itemKind !== 'task' || series.itemId !== task.id) throw new Error('Повторение задачи не найдено');
  await assertTaskRecurrenceOccurrence(source, series, input.occurrence.occursOn);
  const existing = (await source.listRecurrenceOccurrences(series.id)).find((occurrence) => occurrence.occursOn === input.occurrence!.occursOn);
  const occurrenceId = existing?.id ?? stableLegacyUuid('recurrence_occurrences', `${series.id}:${input.occurrence.occursOn}`);
  const effective = await getEffectiveTaskRecurrence(source, series, input.occurrence.occursOn);
  if (effective === null) throw new Error('Экземпляр не принадлежит серии повторения');
  const masterBlocks = effective.blockTemplates === null
    ? (await source.listScheduleBlocksForTaskItem(task.id)).filter((block) => block.occurrenceId === null)
    : fromBlockTemplates(effective.blockTemplates, task.id, updatedAt);
  const currentBlocks = existing?.blocksOverridden
    ? (await source.listScheduleBlocks()).filter((block) => block.occurrenceId === occurrenceId)
    : masterBlocks.map((block) => ({ ...shiftScheduleBlockToDate(block, input.occurrence!.occursOn), id: stableLegacyUuid('schedule_blocks', `${occurrenceId}:${block.id}`), occurrenceId, createdAt: updatedAt, updatedAt, deletedAt: null }));
  const latestId = currentBlocks.reduce<string | null>((result, block) => result === null || new Date(block.endsAt).getTime() > new Date(currentBlocks.find((candidate) => candidate.id === result)!.endsAt).getTime() ? block.id : result, null);
  if (latestId === null) throw new Error('Для повторения нет блока, который можно продлить');
  const extendedBlocks = currentBlocks.map((block) => block.id === latestId ? withThirtyMoreMinutes(block, updatedAt) : { ...block, updatedAt });
  const scheduledBlocks = await synchronizeBlocks(source, task, extendedBlocks, actionTime, scheduler);
  await source.transaction(async () => {
    await persistOccurrenceException(source, {
      occurrence: {
        id: occurrenceId,
        seriesId: series.id,
        occursOn: input.occurrence!.occursOn,
        cancelledAt: null,
        completedAt: existing?.completedAt ?? null,
        blocksOverridden: true,
        taskPatch: existing?.taskPatch ?? null,
        reminderPatch: null,
        createdAt: existing?.createdAt ?? updatedAt,
        updatedAt,
        deletedAt: null,
      },
      blocks: scheduledBlocks,
    }, scheduler);
  });
  if (scheduler !== undefined) await synchronizeRecurrenceNotifications(source, scheduler, actionTime);
}

export async function returnIncompleteTaskToBacklog(source: AppDataSource, input: UnfinishedTaskActionInput & { reason: string | null }, scheduler?: LocalNotificationScheduler): Promise<void> {
  if (input.occurrence === null) {
    await returnTaskToBacklog(source, { taskId: input.taskId, reason: input.reason }, scheduler);
    return;
  }
  const series = await source.getRecurrenceSeries(input.occurrence.seriesId);
  if (series === null || series.itemKind !== 'task' || series.itemId !== input.taskId) throw new Error('Повторение задачи не найдено');
  const task = await source.getTaskItem(input.taskId);
  if (task === null) throw new Error('Задача для возврата в Backlog не найдена');
  await setRecurrenceOccurrenceState(source, series.id, input.occurrence.occursOn, 'cancelled', scheduler);
  const occurrence = (await source.listRecurrenceOccurrences(series.id)).find((candidate) => candidate.occursOn === input.occurrence!.occursOn);
  if (occurrence !== undefined) {
    for (const block of (await source.listScheduleBlocks()).filter((candidate) => candidate.occurrenceId === occurrence.id)) {
      if (scheduler !== undefined) await cancelScheduleBlockNotification(scheduler, block);
      await source.deleteScheduleBlock(block.id);
    }
  }
  const returnedAt = new Date().toISOString();
  const effective = await getEffectiveTaskRecurrence(source, series, input.occurrence.occursOn);
  const patch = { ...(effective?.taskPatch ?? {}), ...(occurrence?.taskPatch ?? {}) };
  await source.saveTaskItem({
    ...task,
    ...patch,
    id: createUuid(),
    completedAt: null,
    scheduledOn: null,
    periodStartOn: null,
    periodEndOn: null,
    createdAt: returnedAt,
    updatedAt: returnedAt,
  });
  await source.saveTransferHistory({ id: createUuid(), taskItemId: input.taskId, reason: input.reason, returnedAt, createdAt: returnedAt });
}

export async function removeRecurrenceOccurrence(source: AppDataSource, input: { seriesId: EntityId; occursOn: string; scope: 'occurrence' | 'series' }, scheduler?: LocalNotificationScheduler): Promise<void> {
  const series = await source.getRecurrenceSeries(input.seriesId);
  if (series === null) throw new Error('Серия повторения не найдена');
  if (series.itemKind === 'task') await assertTaskRecurrenceOccurrence(source, series, input.occursOn);
  else assertRecurrenceOccurrence(series, input.occursOn);
  if (input.scope === 'series') {
    await source.transaction(async () => { await source.deleteRecurrenceSeries(series.id); });
    if (scheduler !== undefined) await synchronizeRecurrenceNotifications(source, scheduler, new Date());
    return;
  }
  const existing = (await source.listRecurrenceOccurrences(series.id)).find((occurrence) => occurrence.occursOn === input.occursOn);
  if (existing !== undefined && (existing.taskPatch?.scheduledOn !== undefined || existing.reminderPatch?.remindsOn !== undefined)) {
    const now = new Date().toISOString();
    await source.saveRecurrenceOccurrence({ ...existing, cancelledAt: now, completedAt: null, taskPatch: null, reminderPatch: null, updatedAt: now });
    return;
  }
  await setRecurrenceOccurrenceState(source, series.id, input.occursOn, 'cancelled', scheduler);
}

export async function syncReminderRecurrence(source: AppDataSource, reminderId: EntityId): Promise<void> {
  const reminder = await source.getReminder(reminderId);
  if (reminder === null) throw new Error('Напоминание не найдено');
  const current = (await source.listRecurrenceSeries()).filter((series) => series.itemKind === 'reminder' && series.itemId === reminderId);
  if (reminder.repeatRule === null || (reminder.remindsOn === null && reminder.periodStartOn === null)) { for (const series of current) await source.deleteRecurrenceSeries(series.id); return; }
  const now = new Date().toISOString();
  await source.saveRecurrenceSeries({ id: current[0]?.id ?? createUuid(), itemKind: 'reminder', itemId: reminderId, frequency: reminder.repeatRule.frequency, interval: reminder.repeatRule.interval, weekdays: reminder.repeatRule.weekdays, startsOn: reminder.remindsOn ?? reminder.periodStartOn!, createdAt: current[0]?.createdAt ?? now, updatedAt: now, deletedAt: null });
}

export type PlanUntimedReminder = Reminder & { seriesId: EntityId | null; occursOn: string | null };
export type PlanUntimedTask = TaskItem & { seriesId: EntityId | null; occursOn: string | null };

type PlanPlacement = {
  plannedOn: string | null;
  periodStartOn: string | null;
  periodEndOn: string | null;
};

function hasPlanPlacement(item: PlanPlacement, isoDate: string): boolean {
  return item.plannedOn === isoDate || (item.periodStartOn !== null && item.periodEndOn !== null && item.periodStartOn <= isoDate && isoDate <= item.periodEndOn);
}

export async function getPlanUntimedReminders(source: AppDataSource, isoDate: string): Promise<readonly PlanUntimedReminder[]> {
  const [reminders, series] = await Promise.all([source.listReminders(), source.listRecurrenceSeries()]);
  const result: PlanUntimedReminder[] = [];
  for (const reminder of reminders) {
    const start = reminder.remindsOn ?? reminder.periodStartOn;
    if (start === null) continue;
    const recurrence = series.find((candidate) => candidate.itemKind === 'reminder' && candidate.itemId === reminder.id);
    if (recurrence !== undefined) {
      if (reminder.completedAt !== null) continue;
      const occurrences = await source.listRecurrenceOccurrences(recurrence.id);
      const occurrence = occurrences.find((candidate) => candidate.occursOn === isoDate);
      if (getRecurrenceDates(recurrence, isoDate, isoDate).includes(isoDate) && !(occurrence?.cancelledAt !== null && occurrence?.cancelledAt !== undefined || occurrence?.completedAt !== null && occurrence?.completedAt !== undefined)) result.push({ ...reminder, ...(occurrence?.reminderPatch ?? {}), seriesId: recurrence.id, occursOn: isoDate });
      for (const moved of occurrences.filter((candidate) => candidate.reminderPatch?.remindsOn === isoDate && candidate.completedAt === null)) result.push({ ...reminder, ...(moved.reminderPatch ?? {}), seriesId: recurrence.id, occursOn: moved.occursOn });
      continue;
    }
    if (hasPlanPlacement({ plannedOn: reminder.remindsOn, periodStartOn: reminder.periodStartOn, periodEndOn: reminder.periodEndOn }, isoDate)) result.push({ ...reminder, seriesId: null, occursOn: null });
  }
  return result;
}

export async function getPlanUntimedTasks(source: AppDataSource, isoDate: string): Promise<readonly PlanUntimedTask[]> {
  const initialTasks = await source.listTaskItems();
  for (const task of initialTasks) if (task.completedAt === null && task.periodEndOn !== null && task.periodEndOn !== undefined && task.periodEndOn < isoDate) await returnTaskToBacklog(source, { taskId: task.id, reason: null });
  const [tasks, blocks, series] = await Promise.all([source.listTaskItems(), source.listScheduleBlocks(), source.listRecurrenceSeries()]);
  const taskIdsWithExactTime = new Set(blocks.map((block) => block.taskItemId));
  const result: PlanUntimedTask[] = [];
  for (const task of tasks) {
    if (taskIdsWithExactTime.has(task.id)) continue;
    const recurrences = series.filter((candidate) => candidate.itemKind === 'task' && candidate.itemId === task.id);
    if (recurrences.length === 0) {
      if (hasPlanPlacement({ plannedOn: task.scheduledOn ?? null, periodStartOn: task.periodStartOn ?? null, periodEndOn: task.periodEndOn ?? null }, isoDate)) result.push({ ...task, seriesId: null, occursOn: null });
      continue;
    }
    for (const recurrence of recurrences) {
      const effective = await getEffectiveTaskRecurrence(source, recurrence, isoDate);
      const occurrences = await source.listRecurrenceOccurrences(recurrence.id);
      const occurrence = occurrences.find((candidate) => candidate.occursOn === isoDate);
      if (effective !== null && getRecurrenceDates(effective.rule, isoDate, isoDate).includes(isoDate) && !(occurrence?.cancelledAt !== null && occurrence?.cancelledAt !== undefined)) {
        result.push({ ...task, ...effective.taskPatch, ...(occurrence?.taskPatch ?? {}), seriesId: recurrence.id, occursOn: isoDate });
      }
      for (const moved of occurrences.filter((candidate) => candidate.taskPatch?.scheduledOn === isoDate)) {
        const movedEffective = await getEffectiveTaskRecurrence(source, recurrence, moved.occursOn);
        result.push({ ...task, ...(movedEffective?.taskPatch ?? {}), ...(moved.taskPatch ?? {}), seriesId: recurrence.id, occursOn: moved.occursOn });
      }
    }
  }
  return result;
}

export async function returnTaskToBacklog(source: AppDataSource, input: { taskId: EntityId; reason: string | null }, scheduler?: LocalNotificationScheduler): Promise<void> {
  const task = await source.getTaskItem(input.taskId);
  if (task === null) throw new Error('Задача для возврата в Backlog не найдена');
  const returnedAt = new Date().toISOString();
  await source.transaction(async () => {
    await source.saveTaskItem({ ...task, completedAt: null, scheduledOn: null, periodStartOn: null, periodEndOn: null });
    for (const block of await source.listScheduleBlocksForTaskItem(task.id)) {
      if (scheduler !== undefined) await cancelScheduleBlockNotification(scheduler, block);
      await source.deleteScheduleBlock(block.id);
    }
    for (const series of await source.listRecurrenceSeries()) if (series.itemKind === 'task' && series.itemId === task.id) await source.deleteRecurrenceSeries(series.id);
    await source.saveTransferHistory({ id: createUuid(), taskItemId: task.id, reason: input.reason, returnedAt, createdAt: returnedAt });
  });
}

export type ReturnPlanItemToBacklogInput =
  | { kind: TaskItem['kind']; id: EntityId; occurrence: { seriesId: EntityId; occursOn: string } | null; reason: string | null }
  | { kind: 'reminder'; id: EntityId; occurrence: null; reason: string | null };

export async function returnPlanItemToBacklog(source: AppDataSource, input: ReturnPlanItemToBacklogInput, scheduler?: LocalNotificationScheduler): Promise<void> {
  if (input.kind !== 'reminder') {
    if (input.occurrence === null) await returnTaskToBacklog(source, { taskId: input.id, reason: input.reason }, scheduler);
    else await returnIncompleteTaskToBacklog(source, { taskId: input.id, occurrence: input.occurrence, reason: input.reason }, scheduler);
    return;
  }

  const reminder = await source.getReminder(input.id);
  if (reminder === null) throw new Error('Напоминание для возврата в Backlog не найдено');
  await source.transaction(async () => {
    await source.saveReminder({ ...reminder, completedAt: null, remindsOn: null, periodStartOn: null, periodEndOn: null });
    for (const series of await source.listRecurrenceSeries()) if (series.itemKind === 'reminder' && series.itemId === reminder.id) await source.deleteRecurrenceSeries(series.id);
  });
}

export async function getPlanScheduleBlocks(source: AppDataSource, isoDate: string): Promise<readonly ScheduleBlock[]> {
  const [blocks, series, tasks] = await Promise.all([source.listScheduleBlocks(), source.listRecurrenceSeries(), source.listTaskItems()]);
  const taskIds = new Set(tasks.filter((task) => task.completedAt === null || blocks.some((block) => block.taskItemId === task.id && getDateInTimeZone(task.completedAt!, block.timeZoneId) === isoDate)).map((task) => task.id));
  const recurringTaskIds = new Set(series.filter((candidate) => candidate.itemKind === 'task').map((candidate) => candidate.itemId));
  const projected: ScheduleBlock[] = blocks.filter((block) => block.occurrenceId === null && taskIds.has(block.taskItemId) && !recurringTaskIds.has(block.taskItemId));
  projected.push(...blocks.filter((block) => block.occurrenceId !== null && taskIds.has(block.taskItemId) && recurringTaskIds.has(block.taskItemId)));
  for (const recurring of series.filter((candidate) => candidate.itemKind === 'task')) {
    const effective = await getEffectiveTaskRecurrence(source, recurring, isoDate);
    if (effective === null || !getRecurrenceDates(effective.rule, isoDate, isoDate).includes(isoDate)) continue;
    const masterBlocks = effective.blockTemplates === null
      ? blocks.filter((block) => block.occurrenceId === null && block.taskItemId === recurring.itemId)
      : fromBlockTemplates(effective.blockTemplates, recurring.itemId, recurring.createdAt);
    if (masterBlocks.length === 0) continue;
    const occurrences = await source.listRecurrenceOccurrences(recurring.id);
    const occurrence = occurrences.find((candidate) => candidate.occursOn === isoDate);
    if (occurrence !== undefined && occurrence.cancelledAt !== null) continue;
    for (let index = 0; index < projected.length; index += 1) {
      const block = projected[index]!;
      if (block.taskItemId !== recurring.itemId || block.occurrenceId === null) continue;
      const storedOccurrence = occurrences.find((candidate) => candidate.id === block.occurrenceId);
      if (storedOccurrence !== undefined) projected[index] = { ...block, displayTaskPatch: { ...effective.taskPatch, ...(storedOccurrence.taskPatch ?? {}) } };
    }
    const selected = occurrence?.blocksOverridden ? [] : masterBlocks.map((block) => ({
      ...shiftScheduleBlockToDate(block, isoDate),
      id: `recurrence-${recurring.id}-${isoDate}-${block.id}`,
      occurrenceId: occurrence?.id ?? `virtual:${recurring.id}:${isoDate}`,
      displayTaskPatch: { ...effective.taskPatch, ...(occurrence?.taskPatch ?? {}) },
    }));
    projected.push(...selected);
  }
  return projected.filter((block) => doesScheduleBlockOverlapDate(block, isoDate));
}
