import type { Reminder, ScheduleBlock, TaskItem } from '../../src/domain/entities';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import {
  convertReminderAndSchedule,
  getOccurrenceDates,
  getPlanLoad,
  resolveScheduleConflict,
  saveOccurrenceException,
  saveReminderPlanning,
  saveTaskPlanning,
} from '../../src/application/planning-use-cases';

const createdAt = '2026-08-05T08:00:00.000Z';

const task: TaskItem = {
  id: 'task-planning-1',
  kind: 'task',
  projectId: null,
  parentTaskId: null,
  title: 'Prepare weekly plan',
  description: null,
  scheduledOn: null,
  periodStartOn: null,
  periodEndOn: null,
  estimatedDurationMinutes: null,
  completedAt: null,
  createdAt,
};

const reminder: Reminder = {
  id: 'reminder-planning-1',
  title: 'Call the insurance company',
  remindsOn: '2026-08-05',
  periodStartOn: null,
  periodEndOn: null,
  repeatRule: { frequency: 'monthly', interval: 1 },
  estimatedDurationMinutes: 15,
  completedAt: null,
  createdAt,
};

function block(id: string, taskItemId = task.id, startsAt = '2026-08-05T09:00:00.000Z', endsAt = '2026-08-05T10:00:00.000Z'): ScheduleBlock {
  return {
    id,
    taskItemId,
    occurrenceId: null,
    startsAt,
    endsAt,
    createdAt,
  };
}

describe('planning use cases', () => {
  test('requires an explicit save decision when a new block conflicts', async () => {
    const source = createInMemoryDataSource();
    const existingBlock = block('block-existing');
    const conflictingBlock = block(
      'block-conflicting',
      task.id,
      '2026-08-05T09:30:00.000Z',
      '2026-08-05T10:30:00.000Z',
    );
    await source.saveTaskItem(task);
    await source.saveScheduleBlock(existingBlock);

    await expect(
      saveTaskPlanning(source, { taskId: task.id, blocks: [conflictingBlock] }),
    ).resolves.toEqual({
      conflict: [expect.objectContaining({ block: existingBlock })],
    });
    await expect(source.getScheduleBlock(conflictingBlock.id)).resolves.toBeNull();

    await resolveScheduleConflict(source, {
      decision: 'save',
      blocks: [conflictingBlock],
    });

    await expect(source.getScheduleBlock(conflictingBlock.id)).resolves.toEqual(
      conflictingBlock,
    );
  });

  test('reports a conflict with a block that belongs to another local task', async () => {
    const source = createInMemoryDataSource();
    const otherTask: TaskItem = { ...task, id: 'task-planning-other' };
    await source.saveTaskItem(task);
    await source.saveTaskItem(otherTask);
    const existingBlock = block('block-other-task', otherTask.id);
    const conflictingBlock = block(
      'block-current-task',
      task.id,
      '2026-08-05T09:30:00.000Z',
      '2026-08-05T10:30:00.000Z',
    );
    await source.saveScheduleBlock(existingBlock);

    await expect(
      saveTaskPlanning(source, { taskId: task.id, blocks: [conflictingBlock] }),
    ).resolves.toEqual({
      conflict: [expect.objectContaining({ block: existingBlock })],
    });
    await expect(source.getScheduleBlock(conflictingBlock.id)).resolves.toBeNull();
  });

  test('stores task date, period and a recurrence series when blocks do not conflict', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);

    await expect(
      saveTaskPlanning(source, {
        taskId: task.id,
        scheduledOn: '2026-08-05',
        periodStartOn: '2026-08-05',
        periodEndOn: '2026-08-08',
        blocks: [block('block-task')],
        recurrence: {
          id: 'series-task',
          frequency: 'weekly',
          interval: 2,
          startsOn: '2026-08-05',
          createdAt,
        },
      }),
    ).resolves.toEqual({ conflict: null });

    await expect(source.getTaskItem(task.id)).resolves.toMatchObject({
      scheduledOn: '2026-08-05',
      periodStartOn: '2026-08-05',
      periodEndOn: '2026-08-08',
    });
    await expect(source.getRecurrenceSeries('series-task')).resolves.toMatchObject({
      itemKind: 'task',
      itemId: task.id,
    });
  });

  test('stores reminder planning and its recurrence series', async () => {
    const source = createInMemoryDataSource();
    await source.saveReminder({ ...reminder, repeatRule: null });

    await saveReminderPlanning(source, {
      reminderId: reminder.id,
      remindsOn: null,
      periodStartOn: '2026-08-10',
      periodEndOn: '2026-08-12',
      recurrence: {
        id: 'series-reminder',
        frequency: 'daily',
        interval: 1,
        startsOn: '2026-08-10',
        createdAt,
      },
    });

    await expect(source.getReminder(reminder.id)).resolves.toMatchObject({
      remindsOn: null,
      periodStartOn: '2026-08-10',
      periodEndOn: '2026-08-12',
      repeatRule: { frequency: 'daily', interval: 1 },
    });
    await expect(source.getRecurrenceSeries('series-reminder')).resolves.toMatchObject({
      itemKind: 'reminder',
      itemId: reminder.id,
    });
  });

  test('cancelling one recurrence occurrence leaves the following occurrence active', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    await source.saveRecurrenceSeries({
      id: 'series-monthly',
      itemKind: 'task',
      itemId: task.id,
      frequency: 'monthly',
      interval: 1,
      startsOn: '2028-01-31',
      createdAt,
    });

    await saveOccurrenceException(source, {
      seriesId: 'series-monthly',
      occursOn: '2028-02-29',
      status: 'cancelled',
      id: 'occurrence-february',
      createdAt,
    });

    await expect(source.getRecurrenceOccurrence('occurrence-february')).resolves.toMatchObject({
      status: 'cancelled',
    });
    expect(
      getOccurrenceDates(
        {
          id: 'series-monthly',
          itemKind: 'task',
          itemId: task.id,
          frequency: 'monthly',
          interval: 1,
          startsOn: '2028-01-31',
          createdAt,
        },
        '2028-02-01',
        '2028-03-31',
      ),
    ).toContain('2028-03-31');
  });

  test('converts a reminder only when the task and its first block are saved', async () => {
    const source = createInMemoryDataSource();
    await source.saveReminder(reminder);
    const scheduledBlock = block(
      'block-converted',
      'task-converted',
      '2026-08-05T11:00:00.000Z',
      '2026-08-05T11:30:00.000Z',
    );

    await convertReminderAndSchedule(source, {
      reminderId: reminder.id,
      projectId: null,
      taskId: 'task-converted',
      block: scheduledBlock,
      createdAt,
    });

    await expect(source.getReminder(reminder.id)).resolves.toBeNull();
    await expect(source.getTaskItem('task-converted')).resolves.toMatchObject({
      title: reminder.title,
      scheduledOn: reminder.remindsOn,
    });
    await expect(source.getScheduleBlock(scheduledBlock.id)).resolves.toEqual(scheduledBlock);
    await expect(source.listRecurrenceSeries()).resolves.toContainEqual(
      expect.objectContaining({ itemKind: 'task', itemId: 'task-converted' }),
    );
  });

  test('rolls conversion back when its first block cannot be saved', async () => {
    const source = createInMemoryDataSource();
    await source.saveReminder(reminder);

    await expect(
      convertReminderAndSchedule(source, {
        reminderId: reminder.id,
        projectId: null,
        taskId: 'task-not-created',
        block: block(
          'block-invalid',
          'task-not-created',
          '2026-08-05T11:00:00.000Z',
          '2026-08-05T11:00:00.000Z',
        ),
        createdAt,
      }),
    ).rejects.toThrow();

    await expect(source.getReminder(reminder.id)).resolves.toEqual(reminder);
    await expect(source.getTaskItem('task-not-created')).resolves.toBeNull();
  });

  test('counts overlapping own blocks above one hundred percent', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    await source.saveScheduleBlock(
      block('block-load-one', task.id, '2026-08-05T08:00:00.000Z', '2026-08-05T18:00:00.000Z'),
    );
    await source.saveScheduleBlock(
      block('block-load-two', task.id, '2026-08-05T08:00:00.000Z', '2026-08-05T18:00:00.000Z'),
    );

    await expect(getPlanLoad(source, '2026-08-05')).resolves.toBeCloseTo(
      (20 / 14) * 100,
    );
  });
});
