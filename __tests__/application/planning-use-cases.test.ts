import { createInMemoryDataSource } from '../../src/data/data-source.web';
import type { ScheduleBlock, TaskItem } from '../../src/domain/entities';
import { createTimedReminderTaskWithPlanning, getPlanScheduleBlocks, getPlanUntimedReminders, moveRecurrenceOccurrence, saveOccurrenceException, saveTaskPlanning, saveTaskWithPlanning, setRecurrenceOccurrenceState, syncReminderRecurrence } from '../../src/application/planning-use-cases';

const createdAt = '2026-08-01T00:00:00.000Z';
const task: TaskItem = { id: 'task-1', kind: 'task', projectId: null, parentTaskId: null, title: 'План', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null };
const block: ScheduleBlock = { id: 'block-1', taskItemId: task.id, occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-03T09:00:00+03:00', endsAt: '2026-08-03T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null };

describe('planning use cases', () => {
  test('does not persist a conflicting block until the user resolves it', async () => {
    const source = createInMemoryDataSource(); await source.saveTaskItem(task); await source.saveScheduleBlock(block);
    await expect(saveTaskPlanning(source, { taskId: task.id, blocks: [{ ...block, id: 'conflict', startsAt: '2026-08-03T09:30:00+03:00', endsAt: '2026-08-03T10:30:00+03:00' }], recurrence: undefined })).resolves.toMatchObject({ conflict: expect.any(Array) });
    await expect(source.getScheduleBlock('conflict')).resolves.toBeNull();
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
});
