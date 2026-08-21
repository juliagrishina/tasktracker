import { createInMemoryDataSource } from '../../src/data/data-source.web';
import type { AppDataSource } from '../../src/data/contracts';
import * as planningUseCases from '../../src/application/planning-use-cases';
import type { ScheduleBlock, TaskItem } from '../../src/domain/entities';
import { createTimedReminderTaskWithPlanning, getPlanScheduleBlocks, getPlanUntimedReminders, moveRecurrenceOccurrence, saveOccurrenceException, saveTaskPlanning, saveTaskWithPlanning, setRecurrenceOccurrenceState, syncReminderRecurrence } from '../../src/application/planning-use-cases';

const createdAt = '2026-08-01T00:00:00.000Z';
const task: TaskItem = { id: 'task-1', kind: 'task', projectId: null, parentTaskId: null, title: 'План', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null };
const block: ScheduleBlock = { id: 'block-1', taskItemId: task.id, occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-03T09:00:00+03:00', endsAt: '2026-08-03T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null };

describe('planning use cases', () => {
  test('projects date-only and period tasks, then records an atomic return to Backlog', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem({ ...task, id: 'date-task', title: 'На дату', scheduledOn: '2026-08-10', periodStartOn: null, periodEndOn: null } as TaskItem);
    await source.saveTaskItem({ ...task, id: 'period-task', title: 'На период', scheduledOn: null, periodStartOn: '2026-08-10', periodEndOn: '2026-08-12' } as TaskItem);
    const api = planningUseCases as unknown as {
      getPlanUntimedTasks(source: AppDataSource, isoDate: string): Promise<readonly TaskItem[]>;
      returnTaskToBacklog(source: AppDataSource, input: { taskId: string; reason: string | null }): Promise<void>;
    };

    await expect(api.getPlanUntimedTasks(source, '2026-08-10')).resolves.toMatchObject([
      { id: 'date-task' },
      { id: 'period-task' },
    ]);
    await expect(api.getPlanUntimedTasks(source, '2026-08-11')).resolves.toMatchObject([{ id: 'period-task' }]);

    await source.saveScheduleBlock({ ...block, id: 'future-block', taskItemId: 'period-task', startsAt: '2026-12-12T09:00:00+03:00', endsAt: '2026-12-12T10:00:00+03:00' });
    await api.returnTaskToBacklog(source, { taskId: 'period-task', reason: 'не хватило времени' });

    await expect(source.getTaskItem('period-task')).resolves.toMatchObject({ scheduledOn: null, periodStartOn: null, periodEndOn: null });
    await expect(source.getScheduleBlock('future-block')).resolves.toBeNull();
    const historySource = source as unknown as { listTransferHistories(): Promise<readonly { taskItemId: string; reason: string | null }[]> };
    await expect(historySource.listTransferHistories()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ taskItemId: 'period-task', reason: 'не хватило времени' })]));
  });

  test('projects an independent date-only recurrence and returns an expired period to Backlog', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem({ ...task, id: 'repeat-date-task', scheduledOn: '2026-08-03', periodStartOn: null, periodEndOn: null } as TaskItem);
    await saveTaskPlanning(source, { taskId: 'repeat-date-task', blocks: [], placement: { scheduledOn: '2026-08-03', periodStartOn: null, periodEndOn: null }, recurrence: { id: 'repeat-date-series', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt } });
    await expect((planningUseCases as unknown as { getPlanUntimedTasks(source: AppDataSource, date: string): Promise<readonly TaskItem[]> }).getPlanUntimedTasks(source, '2026-08-10')).resolves.toMatchObject([{ id: 'repeat-date-task' }]);
    await setRecurrenceOccurrenceState(source, 'repeat-date-series', '2026-08-10', 'completed');
    await expect((planningUseCases as unknown as { getPlanUntimedTasks(source: AppDataSource, date: string): Promise<readonly TaskItem[]> }).getPlanUntimedTasks(source, '2026-08-10')).resolves.toEqual([]);

    await source.saveTaskItem({ ...task, id: 'expired-period-task', scheduledOn: null, periodStartOn: '2026-08-01', periodEndOn: '2026-08-03' } as TaskItem);
    await expect((planningUseCases as unknown as { getPlanUntimedTasks(source: AppDataSource, date: string): Promise<readonly TaskItem[]> }).getPlanUntimedTasks(source, '2026-08-04')).resolves.toEqual([]);
    await expect(source.getTaskItem('expired-period-task')).resolves.toMatchObject({ periodStartOn: null, periodEndOn: null });
  });

  test('does not persist a conflicting block until the user resolves it', async () => {
    const source = createInMemoryDataSource(); await source.saveTaskItem(task); await source.saveScheduleBlock(block);
    await expect(saveTaskPlanning(source, { taskId: task.id, blocks: [{ ...block, id: 'conflict', startsAt: '2026-08-03T09:30:00+03:00', endsAt: '2026-08-03T10:30:00+03:00' }], recurrence: undefined })).resolves.toMatchObject({ conflict: expect.any(Array) });
    await expect(source.getScheduleBlock('conflict')).resolves.toBeNull();
  });

  test('identifies the blocking task in a conflict decision', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem({ ...task, id: 'blocking-task', title: 'Созвон с командой' });
    await source.saveTaskItem(task);
    await source.saveScheduleBlock({ ...block, taskItemId: 'blocking-task' });

    const result = await saveTaskPlanning(source, {
      taskId: task.id,
      blocks: [{ ...block, id: 'candidate', startsAt: '2026-08-03T09:30:00+03:00', endsAt: '2026-08-03T10:30:00+03:00' }],
      recurrence: null,
    });

    expect(result).toMatchObject({ conflict: [expect.objectContaining({ itemTitle: 'Созвон с командой', startsAt: '2026-08-03T09:00:00+03:00', endsAt: '2026-08-03T10:00:00+03:00' })] });
  });

  test('does not create or edit a task before a schedule conflict is resolved', async () => {
    const source = createInMemoryDataSource();
    const blockingTask: TaskItem = { ...task, id: 'task-blocking', title: 'Занято' };
    await source.saveTaskItem(task);
    await source.saveTaskItem(blockingTask);
    await source.saveScheduleBlock({ ...block, taskItemId: blockingTask.id });

    const createResult = await saveTaskWithPlanning(source, {
      task: { mode: 'create', kind: 'task', id: 'task-new', title: 'Новая задача', description: '', projectId: null, estimatedDurationMinutes: null, createdAt },
      planning: { taskId: 'task-new', blocks: [{ ...block, id: 'block-new', taskItemId: 'task-new', startsAt: '2026-08-03T09:30:00+03:00', endsAt: '2026-08-03T10:30:00+03:00' }], recurrence: null },
    });
    expect(createResult.conflict).not.toBeNull();
    await expect(source.getTaskItem('task-new')).resolves.toBeNull();

    const timedReminderResult = await createTimedReminderTaskWithPlanning(source, {
      reminder: { id: 'reminder-timed', title: 'Напомнить', remindsOn: '2026-08-03', periodStartOn: null, periodEndOn: null, repeatRule: null, estimatedDurationMinutes: null, createdAt },
      taskId: 'task-from-reminder',
      projectId: null,
      planning: { taskId: 'task-from-reminder', blocks: [{ ...block, id: 'block-from-reminder', taskItemId: 'task-from-reminder', startsAt: '2026-08-03T09:30:00+03:00', endsAt: '2026-08-03T10:30:00+03:00' }], recurrence: null },
    });
    expect(timedReminderResult.conflict).not.toBeNull();
    await expect(source.getReminder('reminder-timed')).resolves.toBeNull();
    await expect(source.getTaskItem('task-from-reminder')).resolves.toBeNull();

    const editResult = await saveTaskWithPlanning(source, {
      task: { mode: 'edit', kind: 'task', id: task.id, title: 'Не должно сохраниться', description: '', projectId: null, estimatedDurationMinutes: null, createdAt },
      planning: { taskId: task.id, blocks: [{ ...block, id: 'block-edit', taskItemId: task.id, startsAt: '2026-08-03T09:30:00+03:00', endsAt: '2026-08-03T10:30:00+03:00' }], recurrence: null },
    });
    expect(editResult.conflict).not.toBeNull();
    await expect(source.getTaskItem(task.id)).resolves.toMatchObject({ title: 'План' });

    await expect(saveTaskWithPlanning(source, {
      task: { mode: 'create', kind: 'task', id: 'task-new', title: 'Новая задача', description: '', projectId: null, estimatedDurationMinutes: null, createdAt },
      planning: { taskId: 'task-new', forceConflicts: true, blocks: [{ ...block, id: 'block-new', taskItemId: 'task-new', startsAt: '2026-08-03T09:30:00+03:00', endsAt: '2026-08-03T10:30:00+03:00' }], recurrence: null },
    })).resolves.toEqual({ conflict: null });
    await expect(source.getTaskItem('task-new')).resolves.toMatchObject({ title: 'Новая задача' });
  });

  test('projects a recurring task, then respects a cancelled occurrence', async () => {
    const source = createInMemoryDataSource(); await source.saveTaskItem(task);
    await saveTaskPlanning(source, { taskId: task.id, blocks: [block], recurrence: { id: 'series-1', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt } });
    await expect(getPlanScheduleBlocks(source, '2026-08-10')).resolves.toHaveLength(1);
    await saveOccurrenceException(source, { occurrence: { id: 'occurrence-1', seriesId: 'series-1', occursOn: '2026-08-10', cancelledAt: createdAt, completedAt: null, blocksOverridden: false, taskPatch: null, reminderPatch: null, createdAt, updatedAt: createdAt, deletedAt: null } });
    await expect(getPlanScheduleBlocks(source, '2026-08-10')).resolves.toHaveLength(0);
  });

  test('allows one occurrence to explicitly remove its inherited exact time', async () => {
    const source = createInMemoryDataSource(); await source.saveTaskItem(task);
    await saveTaskPlanning(source, { taskId: task.id, blocks: [block], recurrence: { id: 'series-1', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt } });
    await saveOccurrenceException(source, { occurrence: { id: 'occurrence-1', seriesId: 'series-1', occursOn: '2026-08-10', cancelledAt: null, completedAt: null, blocksOverridden: true, taskPatch: null, reminderPatch: null, createdAt, updatedAt: createdAt, deletedAt: null }, blocks: [] });
    await expect(getPlanScheduleBlocks(source, '2026-08-10')).resolves.toHaveLength(0);
  });

  test('completes one recurring instance without completing its series', async () => {
    const source = createInMemoryDataSource(); await source.saveTaskItem(task);
    await saveTaskPlanning(source, { taskId: task.id, blocks: [block], recurrence: { id: 'series-1', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt } });
    await setRecurrenceOccurrenceState(source, 'series-1', '2026-08-10', 'completed');
    await expect(getPlanScheduleBlocks(source, '2026-08-10')).resolves.toHaveLength(0);
    await expect(getPlanScheduleBlocks(source, '2026-08-17')).resolves.toHaveLength(1);
  });

  test('moves either one recurring occurrence or the whole series', async () => {
    const source = createInMemoryDataSource(); await source.saveTaskItem(task);
    await saveTaskPlanning(source, { taskId: task.id, blocks: [block], recurrence: { id: 'series-1', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt } });

    await moveRecurrenceOccurrence(source, { seriesId: 'series-1', occursOn: '2026-08-10', targetDate: '2026-08-11', scope: 'occurrence' });
    await expect(getPlanScheduleBlocks(source, '2026-08-10')).resolves.toHaveLength(0);
    await expect(getPlanScheduleBlocks(source, '2026-08-11')).resolves.toMatchObject([{ startsAt: '2026-08-11T09:00:00+03:00' }]);
    await expect(getPlanScheduleBlocks(source, '2026-08-17')).resolves.toHaveLength(1);

    const seriesResult = await moveRecurrenceOccurrence(source, { seriesId: 'series-1', occursOn: '2026-08-17', targetDate: '2026-08-18', scope: 'series' });
    expect(seriesResult).toEqual({ scope: 'series' });
    await expect(getPlanScheduleBlocks(source, '2026-08-17')).resolves.toHaveLength(0);
    await expect(getPlanScheduleBlocks(source, '2026-08-18')).resolves.toMatchObject([{ startsAt: '2026-08-18T09:00:00+03:00' }]);
  });

  test('shows date-only recurring reminders without adding them to exact load', async () => {
    const source = createInMemoryDataSource();
    await source.saveReminder({ id: 'reminder-1', title: 'Оплатить', remindsOn: '2026-08-03', periodStartOn: null, periodEndOn: null, repeatRule: { frequency: 'weekly', interval: 1 }, estimatedDurationMinutes: 30, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await syncReminderRecurrence(source, 'reminder-1');
    await expect(getPlanUntimedReminders(source, '2026-08-10')).resolves.toMatchObject([{ title: 'Оплатить' }]);
    await expect(getPlanScheduleBlocks(source, '2026-08-10')).resolves.toHaveLength(0);
  });

  test('keeps a reminder occurrence independent and allows deleting only one occurrence', async () => {
    const source = createInMemoryDataSource();
    await source.saveReminder({ id: 'reminder-independent', title: 'Оплатить', remindsOn: '2026-08-03', periodStartOn: null, periodEndOn: null, repeatRule: { frequency: 'weekly', interval: 1 }, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await syncReminderRecurrence(source, 'reminder-independent');
    const series = (await source.listRecurrenceSeries()).find((candidate) => candidate.itemId === 'reminder-independent');
    if (series === undefined) throw new Error('Серия напоминания не создана');

    await setRecurrenceOccurrenceState(source, series.id, '2026-08-10', 'completed');
    await expect(getPlanUntimedReminders(source, '2026-08-10')).resolves.toEqual([]);
    await expect(getPlanUntimedReminders(source, '2026-08-17')).resolves.toMatchObject([{ title: 'Оплатить' }]);

    const api = planningUseCases as unknown as { removeRecurrenceOccurrence(source: AppDataSource, input: { seriesId: string; occursOn: string; scope: 'occurrence' | 'series' }): Promise<void> };
    await api.removeRecurrenceOccurrence(source, { seriesId: series.id, occursOn: '2026-08-17', scope: 'occurrence' });
    await expect(getPlanUntimedReminders(source, '2026-08-17')).resolves.toEqual([]);
    await expect(getPlanUntimedReminders(source, '2026-08-24')).resolves.toMatchObject([{ title: 'Оплатить' }]);
  });
});
