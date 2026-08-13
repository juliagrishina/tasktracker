import type { Reminder, ScheduleBlock, TaskItem } from '../../src/domain/entities';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import {
  convertReminderAndSchedule,
  getOccurrenceDates,
  getTaskPlanningSnapshot,
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
    timeZoneId: null,
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

  test('reports one conflict when two newly proposed blocks overlap each other', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    const firstCandidate = block('block-first-candidate');
    const secondCandidate = block(
      'block-second-candidate',
      task.id,
      '2026-08-05T09:30:00.000Z',
      '2026-08-05T10:30:00.000Z',
    );

    const result = await saveTaskPlanning(source, {
      taskId: task.id,
      blocks: [firstCandidate, secondCandidate],
    });
    expect(result).toMatchObject({
      conflict: [expect.objectContaining({
        candidate: firstCandidate,
        block: secondCandidate,
      })],
    });
    if (result.conflict === null) {
      throw new Error('Expected a scheduling conflict');
    }
    expect(result.conflict).toHaveLength(1);
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

  test('removes a deleted block from an edited planning snapshot', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    const existingBlock = block('block-to-remove');
    await source.saveScheduleBlock(existingBlock);

    await expect(saveTaskPlanning(source, {
      taskId: task.id,
      blocks: [],
      deletedBlockIds: [existingBlock.id],
    })).resolves.toEqual({ conflict: null });

    await expect(source.getScheduleBlock(existingBlock.id)).resolves.toBeNull();
  });

  test('loads only a task master schedule into its editing snapshot', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    const masterBlock = block('master-editing-block');
    const instanceBlock = {
      ...block('instance-editing-block'),
      occurrenceId: 'instance-editing-occurrence',
    };
    await source.saveScheduleBlock(masterBlock);
    await source.saveRecurrenceSeries({
      id: 'editing-series',
      itemKind: 'task',
      itemId: task.id,
      frequency: 'weekly',
      interval: 1,
      startsOn: '2026-08-05',
      createdAt,
    });
    await source.saveRecurrenceOccurrence({
      id: 'instance-editing-occurrence',
      seriesId: 'editing-series',
      occursOn: '2026-08-12',
      status: 'active',
      completedAt: null,
      createdAt,
    });
    await source.saveScheduleBlock(instanceBlock);

    await expect(getTaskPlanningSnapshot(source, task.id)).resolves.toEqual({
      blocks: [masterBlock],
      recurrence: expect.objectContaining({ id: 'editing-series' }),
    });
  });

  test('rejects an invalid local planning date before it reaches storage', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);

    await expect(saveTaskPlanning(source, {
      taskId: task.id,
      scheduledOn: '2026-02-30',
      blocks: [],
    })).rejects.toThrow('формат ГГГГ-ММ-ДД');

    await expect(source.getTaskItem(task.id)).resolves.toEqual(task);
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

  test('keeps an instance-only title and time override apart from its task series', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    await source.saveRecurrenceSeries({
      id: 'series-instance-override',
      itemKind: 'task',
      itemId: task.id,
      frequency: 'weekly',
      interval: 1,
      startsOn: '2026-08-05',
      createdAt,
    });
    const overrideBlock = {
      ...block('instance-override-block', task.id, '2026-08-12T11:00:00.000Z', '2026-08-12T12:00:00.000Z'),
      occurrenceId: 'occurrence-instance-override',
    };

    await saveOccurrenceException(source, {
      id: 'occurrence-instance-override',
      seriesId: 'series-instance-override',
      occursOn: '2026-08-12',
      status: 'active',
      taskPatch: {
        title: 'Сверка перенесена',
        description: 'Только для этой недели',
        scheduledOn: '2026-08-12',
        periodStartOn: null,
        periodEndOn: null,
        estimatedDurationMinutes: 60,
      },
      blocks: [overrideBlock],
      createdAt,
    });

    await expect(source.getRecurrenceOccurrence('occurrence-instance-override')).resolves.toMatchObject({
      taskPatch: expect.objectContaining({ title: 'Сверка перенесена' }),
    });
    await expect(source.getScheduleBlock(overrideBlock.id)).resolves.toEqual(overrideBlock);
    await expect(source.getTaskItem(task.id)).resolves.toEqual(task);
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

  test('counts the second-day portion of an overnight block in plan load', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    await source.saveScheduleBlock(block(
      'overnight-load-block',
      task.id,
      '2026-08-05T23:30:00+03:00',
      '2026-08-06T00:30:00+03:00',
    ));

    await expect(getPlanLoad(source, '2026-08-06')).resolves.toBeCloseTo(
      (30 / (14 * 60)) * 100,
    );
  });

  test('updates an existing series in place and preserves its instance exception', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    const masterBlock = block('preserved-master-block');
    const overrideBlock = {
      ...block('preserved-override-block', task.id, '2026-08-12T11:00:00+03:00', '2026-08-12T12:00:00+03:00'),
      occurrenceId: 'preserved-occurrence',
    };
    await source.saveScheduleBlock(masterBlock);
    await source.saveRecurrenceSeries({
      id: 'preserved-series',
      itemKind: 'task',
      itemId: task.id,
      frequency: 'weekly',
      interval: 1,
      startsOn: '2026-08-05',
      createdAt,
    });
    await source.saveRecurrenceOccurrence({
      id: 'preserved-occurrence',
      seriesId: 'preserved-series',
      occursOn: '2026-08-12',
      status: 'active',
      completedAt: null,
      createdAt,
    });
    await source.saveScheduleBlock(overrideBlock);

    await expect(saveTaskPlanning(source, {
      taskId: task.id,
      blocks: [masterBlock],
      recurrence: {
        id: 'new-generated-series-id',
        frequency: 'weekly',
        interval: 1,
        startsOn: '2026-08-05',
        createdAt: '2026-08-13T08:00:00.000Z',
      },
    })).resolves.toEqual({ conflict: null });

    await expect(source.getRecurrenceSeries('preserved-series')).resolves.toMatchObject({
      id: 'preserved-series',
    });
    await expect(source.getRecurrenceOccurrence('preserved-occurrence')).resolves.toMatchObject({
      seriesId: 'preserved-series',
    });
    await expect(source.getScheduleBlock(overrideBlock.id)).resolves.toEqual(overrideBlock);
  });

  test('removes an override that is no longer generated after a series rule change', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    await source.saveRecurrenceSeries({
      id: 'changed-rule-series',
      itemKind: 'task',
      itemId: task.id,
      frequency: 'weekly',
      interval: 1,
      startsOn: '2026-08-05',
      createdAt,
    });
    await source.saveRecurrenceOccurrence({
      id: 'changed-rule-occurrence',
      seriesId: 'changed-rule-series',
      occursOn: '2026-08-12',
      status: 'active',
      completedAt: null,
      createdAt,
    });
    await source.saveScheduleBlock({
      ...block('changed-rule-override', task.id, '2026-08-12T11:00:00+03:00', '2026-08-12T12:00:00+03:00'),
      occurrenceId: 'changed-rule-occurrence',
    });

    await expect(saveTaskPlanning(source, {
      taskId: task.id,
      blocks: [],
      recurrence: {
        id: 'ignored-new-id',
        frequency: 'monthly',
        interval: 1,
        startsOn: '2026-08-05',
        createdAt: '2026-08-13T08:00:00.000Z',
      },
    })).resolves.toEqual({ conflict: null });

    await expect(source.getRecurrenceOccurrence('changed-rule-occurrence')).resolves.toBeNull();
    await expect(source.getScheduleBlock('changed-rule-override')).resolves.toBeNull();
  });

  test('removes exception blocks together with a series that is stopped', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    await source.saveRecurrenceSeries({
      id: 'stopped-series',
      itemKind: 'task',
      itemId: task.id,
      frequency: 'weekly',
      interval: 1,
      startsOn: '2026-08-05',
      createdAt,
    });
    await source.saveRecurrenceOccurrence({
      id: 'stopped-series-occurrence',
      seriesId: 'stopped-series',
      occursOn: '2026-08-12',
      status: 'active',
      completedAt: null,
      createdAt,
    });
    await source.saveScheduleBlock({
      ...block('stopped-series-override', task.id, '2026-08-12T11:00:00+03:00', '2026-08-12T12:00:00+03:00'),
      occurrenceId: 'stopped-series-occurrence',
    });

    await expect(saveTaskPlanning(source, {
      taskId: task.id,
      blocks: [],
      recurrence: null,
    })).resolves.toEqual({ conflict: null });

    await expect(source.getRecurrenceSeries('stopped-series')).resolves.toBeNull();
    await expect(source.getRecurrenceOccurrence('stopped-series-occurrence')).resolves.toBeNull();
    await expect(source.getScheduleBlock('stopped-series-override')).resolves.toBeNull();
  });
});
