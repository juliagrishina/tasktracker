import { createInMemoryDataSource } from '../../src/data/data-source.web';
import type { AppDataSource } from '../../src/data/contracts';
import * as planningUseCases from '../../src/application/planning-use-cases';
import type { ScheduleBlock, TaskItem } from '../../src/domain/entities';
import type { LocalNotificationScheduler } from '../../src/application/notification-scheduling';
import { continueIncompleteTask, createTimedReminderTaskWithPlanning, getPlanScheduleBlocks, getPlanUntimedReminders, moveRecurrenceOccurrence, returnIncompleteTaskToBacklog, saveOccurrenceException, saveRecurrenceRevision, saveTaskPlanning, saveTaskWithPlanning, setRecurrenceOccurrenceState, synchronizeRecurrenceNotifications, syncReminderRecurrence } from '../../src/application/planning-use-cases';
import { updatePlanningSettings } from '../../src/application/settings-use-cases';
import { getDefaultSettings } from '../../src/data/default-settings';

const createdAt = '2026-08-01T00:00:00.000Z';
const task: TaskItem = { id: 'task-1', kind: 'task', projectId: null, parentTaskId: null, title: 'План', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null };
const block: ScheduleBlock = { id: 'block-1', taskItemId: task.id, occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-03T09:00:00+03:00', endsAt: '2026-08-03T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null };

describe('planning use cases', () => {
  test('saves validated planning settings and recreates future notifications with the new lead time', async () => {
    const source = createInMemoryDataSource();
    const scheduler: LocalNotificationScheduler = {
      schedule: jest.fn().mockResolvedValueOnce('new-block-notification').mockResolvedValueOnce('new-evening-notification'),
      cancel: jest.fn(),
    };
    const futureBlock = {
      ...block,
      notificationId: 'old-block-notification',
      startsAt: '2026-08-29T10:00:00+03:00',
      endsAt: '2026-08-29T11:00:00+03:00',
    };
    await source.saveTaskItem(task);
    await source.saveTaskItem({ ...task, id: 'today-task', title: 'На сегодня', scheduledOn: '2026-08-28', periodStartOn: null, periodEndOn: null });
    await source.saveScheduleBlock(futureBlock);
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow', timeZoneMode: 'manual', eveningReviewNotificationId: 'old-evening-notification' });

    await updatePlanningSettings(source, {
      workdayStartsAt: '09:00',
      workdayEndsAt: '18:00',
      eveningReviewAt: '20:00',
      notificationLeadMinutes: 30,
    }, scheduler, new Date('2026-08-28T09:00:00.000Z'));

    await expect(source.getSettings()).resolves.toMatchObject({
      workdayStartsAt: '09:00',
      workdayEndsAt: '18:00',
      eveningReviewAt: '20:00',
      notificationLeadMinutes: 30,
      eveningReviewNotificationId: 'new-evening-notification',
    });
    await expect(source.getScheduleBlock(futureBlock.id)).resolves.toMatchObject({ notificationId: 'new-block-notification' });
    expect(scheduler.cancel).toHaveBeenCalledWith('old-block-notification');
    expect(scheduler.cancel).toHaveBeenCalledWith('old-evening-notification');
    expect(scheduler.schedule).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('План'),
      scheduledAt: '2026-08-29T06:30:00.000Z',
    }));
    expect(scheduler.schedule).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Вечерняя проверка',
      scheduledAt: '2026-08-28T17:00:00.000Z',
    }));
  });

  test('rejects invalid planning settings without changing stored values', async () => {
    const source = createInMemoryDataSource();
    await source.saveSettings({ ...getDefaultSettings(), workdayStartsAt: '08:00', workdayEndsAt: '22:00' });

    await expect(updatePlanningSettings(source, {
      workdayStartsAt: '22:00',
      workdayEndsAt: '08:00',
      eveningReviewAt: '21:00',
      notificationLeadMinutes: 10,
    })).rejects.toThrow('Время окончания рабочего дня должно быть позже времени начала');
    await expect(source.getSettings()).resolves.toMatchObject({ workdayStartsAt: '08:00', workdayEndsAt: '22:00' });
  });

  test('rebuilds future recurring instance notifications with the new lead time', async () => {
    const source = createInMemoryDataSource();
    const scheduler: LocalNotificationScheduler = {
      schedule: jest.fn().mockResolvedValue('new-recurrence-notification'),
      cancel: jest.fn(),
    };
    const recurringBlock = {
      ...block,
      startsAt: '2026-08-29T10:00:00+03:00',
      endsAt: '2026-08-29T11:00:00+03:00',
    };
    await source.saveTaskItem(task);
    await saveTaskPlanning(source, {
      taskId: task.id,
      blocks: [recurringBlock],
      recurrence: { id: 'settings-series', frequency: 'weekly', interval: 1, startsOn: '2026-08-29', createdAt },
    });
    await source.saveRecurrenceOccurrence({
      id: 'occurrence-settings-series-2026-08-29',
      seriesId: 'settings-series',
      occursOn: '2026-08-29',
      cancelledAt: null,
      completedAt: null,
      blocksOverridden: false,
      taskPatch: null,
      reminderPatch: null,
      notificationIds: ['old-recurrence-notification'],
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    });

    await updatePlanningSettings(source, {
      workdayStartsAt: '08:00',
      workdayEndsAt: '22:00',
      eveningReviewAt: '21:00',
      notificationLeadMinutes: 30,
    }, scheduler, new Date('2026-08-28T09:00:00.000Z'));

    expect(scheduler.cancel).toHaveBeenCalledWith('old-recurrence-notification');
    expect(scheduler.schedule).toHaveBeenCalledWith(expect.objectContaining({ scheduledAt: '2026-08-29T06:30:00.000Z' }));
    await expect(source.listRecurrenceOccurrences('settings-series')).resolves.toContainEqual(expect.objectContaining({
      occursOn: '2026-08-29',
      notificationIds: ['new-recurrence-notification'],
    }));
  });

  test('extends the final block of an unfinished task by 30 minutes', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    await source.saveScheduleBlock(block);

    await continueIncompleteTask(source, { taskId: task.id, occurrence: null });

    await expect(source.getScheduleBlock(block.id)).resolves.toMatchObject({ startsAt: '2026-08-03T09:00:00+03:00', endsAt: '2026-08-03T07:30:00.000Z' });
  });

  test('extends only the selected recurring occurrence by 30 minutes', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    await saveTaskPlanning(source, { taskId: task.id, blocks: [block], recurrence: { id: 'continue-series', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt } });

    await continueIncompleteTask(source, { taskId: task.id, occurrence: { seriesId: 'continue-series', occursOn: '2026-08-10' } });

    await expect(getPlanScheduleBlocks(source, '2026-08-10')).resolves.toMatchObject([{ startsAt: '2026-08-10T09:00:00+03:00', endsAt: '2026-08-10T07:30:00.000Z' }]);
    await expect(getPlanScheduleBlocks(source, '2026-08-17')).resolves.toMatchObject([{ startsAt: '2026-08-17T09:00:00+03:00', endsAt: '2026-08-17T10:00:00+03:00' }]);
  });

  test('returns an unfinished task to Backlog and removes its elapsed schedule block', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem({ ...task, scheduledOn: '2026-08-03', periodStartOn: null, periodEndOn: null } as TaskItem);
    await source.saveScheduleBlock(block);

    await returnIncompleteTaskToBacklog(source, { taskId: task.id, occurrence: null, reason: 'Планы изменились' });

    await expect(source.getTaskItem(task.id)).resolves.toMatchObject({ scheduledOn: null, periodStartOn: null, periodEndOn: null });
    await expect(source.getScheduleBlock(block.id)).resolves.toBeNull();
  });

  test('returns one recurring occurrence as a standalone Backlog task', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    await source.saveScheduleBlock(block);
    await source.saveRecurrenceSeries({ id: 'return-series', itemKind: 'task', itemId: task.id, frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt, updatedAt: createdAt, deletedAt: null });

    await returnIncompleteTaskToBacklog(source, { taskId: task.id, occurrence: { seriesId: 'return-series', occursOn: '2026-08-10' }, reason: null });

    await expect(source.listTaskItems()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: `backlog-${task.id}-2026-08-10`, title: task.title, scheduledOn: null }),
    ]));
    await expect(getPlanScheduleBlocks(source, '2026-08-17')).resolves.toMatchObject([
      expect.objectContaining({ taskItemId: task.id }),
    ]);
  });

  test('revises a recurring task only from the selected date and preserves earlier occurrences', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    await saveTaskPlanning(source, {
      taskId: task.id,
      blocks: [block],
      recurrence: { id: 'revision-series', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt },
    });

    await saveRecurrenceRevision(source, {
      seriesId: 'revision-series',
      effectiveFrom: '2026-08-10',
      taskPatch: { title: 'Обновлённый план', estimatedDurationMinutes: 90 },
      recurrence: { frequency: 'weekly', interval: 1, startsOn: '2026-08-10' },
      blocks: [{ ...block, startsAt: '2026-08-10T11:00:00+03:00', endsAt: '2026-08-10T12:30:00+03:00' }],
    });

    await expect(getPlanScheduleBlocks(source, '2026-08-03')).resolves.toMatchObject([{ startsAt: '2026-08-03T09:00:00+03:00' }]);
    await expect(getPlanScheduleBlocks(source, '2026-08-10')).resolves.toMatchObject([{ startsAt: '2026-08-10T11:00:00+03:00', endsAt: '2026-08-10T12:30:00+03:00', displayTaskPatch: { title: 'Обновлённый план' } }]);
    await expect(getPlanScheduleBlocks(source, '2026-08-17')).resolves.toMatchObject([{ startsAt: '2026-08-17T11:00:00+03:00' }]);
  });

  test('persists a newly scheduled notification when a future block is saved', async () => {
    const source = createInMemoryDataSource();
    const scheduler: LocalNotificationScheduler = {
      schedule: jest.fn().mockResolvedValue('notification-1'),
      cancel: jest.fn(),
    };
    const futureBlock = {
      ...block,
      startsAt: '2026-09-01T10:00:00+03:00',
      endsAt: '2026-09-01T11:00:00+03:00',
    };
    await source.saveTaskItem(task);

    await saveTaskPlanning(source, { taskId: task.id, blocks: [futureBlock], recurrence: null }, scheduler);

    await expect(source.getScheduleBlock(block.id)).resolves.toMatchObject({ notificationId: 'notification-1' });
    expect(scheduler.schedule).toHaveBeenCalledWith(expect.objectContaining({ scheduledAt: '2026-09-01T06:50:00.000Z' }));
  });

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

  test('keeps a completed date-only recurrence in its planned day and returns an expired period to Backlog', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem({ ...task, id: 'repeat-date-task', scheduledOn: '2026-08-03', periodStartOn: null, periodEndOn: null } as TaskItem);
    await saveTaskPlanning(source, { taskId: 'repeat-date-task', blocks: [], placement: { scheduledOn: '2026-08-03', periodStartOn: null, periodEndOn: null }, recurrence: { id: 'repeat-date-series', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt } });
    await expect((planningUseCases as unknown as { getPlanUntimedTasks(source: AppDataSource, date: string): Promise<readonly TaskItem[]> }).getPlanUntimedTasks(source, '2026-08-10')).resolves.toMatchObject([{ id: 'repeat-date-task' }]);
    await setRecurrenceOccurrenceState(source, 'repeat-date-series', '2026-08-10', 'completed');
    await expect((planningUseCases as unknown as { getPlanUntimedTasks(source: AppDataSource, date: string): Promise<readonly TaskItem[]> }).getPlanUntimedTasks(source, '2026-08-10')).resolves.toMatchObject([{ id: 'repeat-date-task' }]);

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

  test('keeps one completed recurring instance in its day without completing its series', async () => {
    const source = createInMemoryDataSource(); await source.saveTaskItem(task);
    await saveTaskPlanning(source, { taskId: task.id, blocks: [block], recurrence: { id: 'series-1', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt } });
    await setRecurrenceOccurrenceState(source, 'series-1', '2026-08-10', 'completed');
    await expect(getPlanScheduleBlocks(source, '2026-08-10')).resolves.toHaveLength(1);
    await expect(getPlanScheduleBlocks(source, '2026-08-17')).resolves.toHaveLength(1);
  });

  test('synchronizes concrete notifications for the 90-day recurring horizon and removes a completed occurrence notification', async () => {
    const source = createInMemoryDataSource();
    const scheduler: LocalNotificationScheduler = {
      schedule: jest.fn().mockResolvedValue('recurrence-notification'),
      cancel: jest.fn(),
    };
    await source.saveTaskItem(task);
    await saveTaskPlanning(source, {
      taskId: task.id,
      blocks: [block],
      recurrence: { id: 'notification-series', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt },
    });

    await synchronizeRecurrenceNotifications(source, scheduler, new Date('2026-08-01T00:00:00.000Z'));

    expect(scheduler.schedule).toHaveBeenCalledWith(expect.objectContaining({ scheduledAt: '2026-08-03T05:50:00.000Z' }));
    const occurrence = (await source.listRecurrenceOccurrences('notification-series')).find((candidate) => candidate.occursOn === '2026-08-03');
    expect(occurrence?.notificationIds).toEqual(['recurrence-notification']);

    await setRecurrenceOccurrenceState(source, 'notification-series', '2026-08-03', 'completed', scheduler, new Date('2026-08-01T00:00:00.000Z'));

    expect(scheduler.cancel).toHaveBeenCalledWith('recurrence-notification');
    await expect(source.listRecurrenceOccurrences('notification-series')).resolves.toContainEqual(expect.objectContaining({ occursOn: '2026-08-03', completedAt: expect.any(String), notificationIds: [] }));
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

  test('moves one date-only recurring task without changing sibling occurrences', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem({ ...task, id: 'untimed-move-task', scheduledOn: '2026-08-03', periodStartOn: null, periodEndOn: null } as TaskItem);
    await saveTaskPlanning(source, { taskId: 'untimed-move-task', blocks: [], placement: { scheduledOn: '2026-08-03', periodStartOn: null, periodEndOn: null }, recurrence: { id: 'untimed-move-series', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt } });

    await moveRecurrenceOccurrence(source, { seriesId: 'untimed-move-series', occursOn: '2026-08-10', targetDate: '2026-08-11', scope: 'occurrence' });

    const api = planningUseCases as unknown as { getPlanUntimedTasks(source: AppDataSource, date: string): Promise<readonly TaskItem[]> };
    await expect(api.getPlanUntimedTasks(source, '2026-08-10')).resolves.toEqual([]);
    await expect(api.getPlanUntimedTasks(source, '2026-08-11')).resolves.toMatchObject([{ id: 'untimed-move-task' }]);
    await expect(api.getPlanUntimedTasks(source, '2026-08-17')).resolves.toMatchObject([{ id: 'untimed-move-task' }]);
  });

  test('moves one recurring reminder without changing sibling occurrences', async () => {
    const source = createInMemoryDataSource();
    await source.saveReminder({ id: 'untimed-move-reminder', title: 'Проверить отчёт', remindsOn: '2026-08-03', periodStartOn: null, periodEndOn: null, repeatRule: { frequency: 'weekly', interval: 1 }, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await syncReminderRecurrence(source, 'untimed-move-reminder');
    const series = (await source.listRecurrenceSeries()).find((candidate) => candidate.itemId === 'untimed-move-reminder');
    if (series === undefined) throw new Error('Серия напоминания не создана');

    await moveRecurrenceOccurrence(source, { seriesId: series.id, occursOn: '2026-08-10', targetDate: '2026-08-11', scope: 'occurrence' });

    await expect(getPlanUntimedReminders(source, '2026-08-10')).resolves.toEqual([]);
    await expect(getPlanUntimedReminders(source, '2026-08-11')).resolves.toMatchObject([{ id: 'untimed-move-reminder' }]);
    await expect(getPlanUntimedReminders(source, '2026-08-17')).resolves.toMatchObject([{ id: 'untimed-move-reminder' }]);
  });

  test('shows date-only recurring reminders without adding them to exact load', async () => {
    const source = createInMemoryDataSource();
    await source.saveReminder({ id: 'reminder-1', title: 'Оплатить', remindsOn: '2026-08-03', periodStartOn: null, periodEndOn: null, repeatRule: { frequency: 'weekly', interval: 1 }, estimatedDurationMinutes: 30, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await syncReminderRecurrence(source, 'reminder-1');
    await expect(getPlanUntimedReminders(source, '2026-08-10')).resolves.toMatchObject([{ title: 'Оплатить' }]);
    await expect(getPlanScheduleBlocks(source, '2026-08-10')).resolves.toHaveLength(0);
  });

  test('preserves selected weekdays in a recurring reminder series', async () => {
    const source = createInMemoryDataSource();
    await source.saveReminder({ id: 'weekday-reminder', title: 'Тренировка', remindsOn: '2026-08-03', periodStartOn: null, periodEndOn: null, repeatRule: { frequency: 'weekly', interval: 1, weekdays: [1, 3] }, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });

    await syncReminderRecurrence(source, 'weekday-reminder');

    await expect(getPlanUntimedReminders(source, '2026-08-05')).resolves.toMatchObject([{ id: 'weekday-reminder' }]);
    await expect(getPlanUntimedReminders(source, '2026-08-04')).resolves.toEqual([]);
    await expect(source.listRecurrenceSeries()).resolves.toMatchObject([expect.objectContaining({ itemId: 'weekday-reminder', weekdays: [1, 3] })]);
  });

  test('converts an existing recurring reminder into a recurring task with exact time', async () => {
    const source = createInMemoryDataSource();
    await source.saveReminder({ id: 'existing-reminder', title: 'Оплатить счёт', remindsOn: '2026-08-03', periodStartOn: null, periodEndOn: null, repeatRule: { frequency: 'weekly', interval: 1, weekdays: [1, 3] }, estimatedDurationMinutes: 30, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });

    await expect(createTimedReminderTaskWithPlanning(source, {
      reminder: { id: 'existing-reminder', title: 'Оплатить счёт', remindsOn: '2026-08-03', periodStartOn: null, periodEndOn: null, repeatRule: { frequency: 'weekly', interval: 1, weekdays: [1, 3] }, estimatedDurationMinutes: 30, createdAt },
      taskId: 'task-existing-reminder',
      projectId: null,
      planning: { taskId: 'task-existing-reminder', blocks: [{ ...block, id: 'existing-reminder-block', taskItemId: 'task-existing-reminder' }], recurrence: null },
    })).resolves.toEqual({ conflict: null });

    await expect(source.getReminder('existing-reminder')).resolves.toBeNull();
    await expect(source.getTaskItem('task-existing-reminder')).resolves.toMatchObject({ title: 'Оплатить счёт' });
    await expect(source.listRecurrenceSeries()).resolves.toMatchObject([expect.objectContaining({ itemKind: 'task', itemId: 'task-existing-reminder', frequency: 'weekly', weekdays: [1, 3] })]);
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
