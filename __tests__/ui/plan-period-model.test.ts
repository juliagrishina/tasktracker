import {
  getPlanLoadTone,
  shiftPlanAnchor,
} from '../../src/ui/plan/plan-period-model';
import {
  getDayPlan,
  getPeriodDates,
  getPlanLoadDays,
} from '../../src/application/plan-load-selector';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { createTask } from '../../src/application/backlog-use-cases';
import { saveOccurrenceException } from '../../src/application/planning-use-cases';

describe('plan period load model', () => {
  test('maps all approved load thresholds without capping overload', () => {
    expect(getPlanLoadTone(0)).toBe('low');
    expect(getPlanLoadTone(50)).toBe('low');
    expect(getPlanLoadTone(51)).toBe('medium');
    expect(getPlanLoadTone(70)).toBe('medium');
    expect(getPlanLoadTone(71)).toBe('high');
    expect(getPlanLoadTone(104)).toBe('high');
  });

  test('builds a Monday-first seven-day week around its selected day', () => {
    expect(getPeriodDates('2026-08-05', 'week')).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
    ]);
    expect(shiftPlanAnchor('2026-08-05', 'week', 1)).toBe('2026-08-12');
  });

  test('calculates week load from a persisted 15-hour block instead of demo percentages', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'load-task',
      title: 'Подготовить релиз',
      createdAt: '2026-08-01T08:00:00.000Z',
    });
    await source.saveScheduleBlock({
      id: 'fifteen-hour-block',
      taskItemId: task.id,
      occurrenceId: null,
      startsAt: '2026-08-05T07:00:00+03:00',
      endsAt: '2026-08-05T22:00:00+03:00',
      timeZoneId: null,
      createdAt: task.createdAt,
    });

    await expect(getPlanLoadDays(source, '2026-08-05', 'week'))
      .resolves.toContainEqual(expect.objectContaining({
        isoDate: '2026-08-05',
        loadPercent: 107.14285714285714,
        tone: 'high',
      }));
  });

  test('shows the following-day portion of an overnight block in the day plan', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'overnight-day-plan-task',
      title: 'РќРѕС‡РЅР°СЏ РѕРїРµСЂР°С†РёСЏ',
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    await source.saveScheduleBlock({
      id: 'overnight-day-plan-block',
      taskItemId: task.id,
      occurrenceId: null,
      startsAt: '2026-08-05T23:30:00+03:00',
      endsAt: '2026-08-06T00:30:00+03:00',
      timeZoneId: null,
      createdAt: task.createdAt,
    });

    await expect(getDayPlan(source, '2026-08-06')).resolves.toMatchObject({
      blocks: [expect.objectContaining({
        title: 'РќРѕС‡РЅР°СЏ РѕРїРµСЂР°С†РёСЏ',
        startsAt: '2026-08-06T00:00:00+03:00',
        endsAt: '2026-08-06T00:30:00+03:00',
      })],
      loadPercent: expect.closeTo((30 / (14 * 60)) * 100),
    });
  });

  test('projects a recurring task block into a later day and its load', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'weekly-task',
      title: 'Еженедельная сверка',
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    await source.saveScheduleBlock({
      id: 'weekly-source-block',
      taskItemId: task.id,
      occurrenceId: null,
      startsAt: '2026-08-05T09:00:00+03:00',
      endsAt: '2026-08-05T10:00:00+03:00',
      timeZoneId: null,
      createdAt: task.createdAt,
    });
    await source.saveRecurrenceSeries({
      id: 'weekly-series',
      itemKind: 'task',
      itemId: task.id,
      frequency: 'weekly',
      interval: 1,
      startsOn: '2026-08-05',
      createdAt: task.createdAt,
    });

    await expect(getDayPlan(source, '2026-08-12')).resolves.toMatchObject({
      blocks: [expect.objectContaining({
        title: 'Еженедельная сверка',
        startsAt: '2026-08-12T09:00:00+03:00',
        endsAt: '2026-08-12T10:00:00+03:00',
      })],
      loadPercent: expect.closeTo(7.142857142857143),
    });
  });

  test('projects a zoned recurring task block at the same wall time across DST', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'dst-weekly-task',
      title: 'New York weekly review',
      createdAt: '2026-03-01T08:00:00.000Z',
    });
    await source.saveScheduleBlock({
      id: 'dst-weekly-source-block',
      taskItemId: task.id,
      occurrenceId: null,
      startsAt: '2026-03-01T09:00:00-05:00',
      endsAt: '2026-03-01T10:00:00-05:00',
      timeZoneId: 'America/New_York',
      createdAt: task.createdAt,
    });
    await source.saveRecurrenceSeries({
      id: 'dst-weekly-series',
      itemKind: 'task',
      itemId: task.id,
      frequency: 'weekly',
      interval: 1,
      startsOn: '2026-03-01',
      createdAt: task.createdAt,
    });

    await expect(getDayPlan(source, '2026-03-08')).resolves.toMatchObject({
      blocks: [expect.objectContaining({
        startsAt: '2026-03-08T09:00:00-04:00',
        endsAt: '2026-03-08T10:00:00-04:00',
      })],
    });
  });

  test('keeps the source occurrence context when a recurring block falls on its following day', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'following-day-recurring-task',
      title: 'Ночной еженедельный блок',
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    await source.saveScheduleBlock({
      id: 'following-day-source-block',
      taskItemId: task.id,
      occurrenceId: null,
      startsAt: '2026-08-06T00:30:00+03:00',
      endsAt: '2026-08-06T01:00:00+03:00',
      timeZoneId: null,
      createdAt: task.createdAt,
    });
    await source.saveRecurrenceSeries({
      id: 'following-day-series',
      itemKind: 'task',
      itemId: task.id,
      frequency: 'weekly',
      interval: 1,
      startsOn: '2026-08-05',
      createdAt: task.createdAt,
    });

    await expect(getDayPlan(source, '2026-08-13')).resolves.toMatchObject({
      blocks: [expect.objectContaining({
        startsAt: '2026-08-13T00:30:00+03:00',
        occurrence: expect.objectContaining({ occursOn: '2026-08-12' }),
      })],
    });
  });

  test('shows an instance override once and keeps the following series occurrence unchanged', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'override-task',
      title: 'Еженедельная сверка',
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    await source.saveScheduleBlock({
      id: 'override-source-block',
      taskItemId: task.id,
      occurrenceId: null,
      startsAt: '2026-08-05T09:00:00+03:00',
      endsAt: '2026-08-05T10:00:00+03:00',
      timeZoneId: null,
      createdAt: task.createdAt,
    });
    await source.saveRecurrenceSeries({
      id: 'override-series',
      itemKind: 'task',
      itemId: task.id,
      frequency: 'weekly',
      interval: 1,
      startsOn: '2026-08-05',
      createdAt: task.createdAt,
    });
    await saveOccurrenceException(source, {
      id: 'override-occurrence',
      seriesId: 'override-series',
      occursOn: '2026-08-12',
      status: 'active',
      taskPatch: {
        title: 'Сверка в другое время',
        description: null,
        scheduledOn: '2026-08-12',
        periodStartOn: null,
        periodEndOn: null,
        estimatedDurationMinutes: 60,
      },
      blocks: [{
        id: 'override-custom-block',
        taskItemId: task.id,
        occurrenceId: 'override-occurrence',
        startsAt: '2026-08-12T11:00:00+03:00',
        endsAt: '2026-08-12T12:00:00+03:00',
        timeZoneId: null,
        createdAt: task.createdAt,
      }],
      createdAt: task.createdAt,
    });

    await expect(getDayPlan(source, '2026-08-12')).resolves.toMatchObject({
      blocks: [expect.objectContaining({
        id: 'override-custom-block',
        title: 'Сверка в другое время',
      })],
    });
    await expect(getDayPlan(source, '2026-08-19')).resolves.toMatchObject({
      blocks: [expect.objectContaining({
        title: 'Еженедельная сверка',
        startsAt: '2026-08-19T09:00:00+03:00',
      })],
    });
  });

  test('shows an active occurrence without replacement blocks as untimed', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'remove-instance-block-task',
      title: 'Сверка со временем',
      estimatedDurationMinutes: 30,
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    await source.saveTaskItem({ ...task, scheduledOn: '2026-08-05' });
    await source.saveScheduleBlock({
      id: 'remove-instance-master-block',
      taskItemId: task.id,
      occurrenceId: null,
      startsAt: '2026-08-05T09:00:00+03:00',
      endsAt: '2026-08-05T10:00:00+03:00',
      timeZoneId: null,
      createdAt: task.createdAt,
    });
    await source.saveRecurrenceSeries({
      id: 'remove-instance-block-series',
      itemKind: 'task',
      itemId: task.id,
      frequency: 'weekly',
      interval: 1,
      startsOn: '2026-08-05',
      createdAt: task.createdAt,
    });
    await saveOccurrenceException(source, {
      id: 'remove-instance-block-occurrence',
      seriesId: 'remove-instance-block-series',
      occursOn: '2026-08-12',
      status: 'active',
      taskPatch: {
        title: 'Сверка без времени',
        description: null,
        scheduledOn: '2026-08-12',
        periodStartOn: null,
        periodEndOn: null,
        estimatedDurationMinutes: 30,
      },
      blocks: [],
      createdAt: task.createdAt,
    });

    await expect(getDayPlan(source, '2026-08-12')).resolves.toMatchObject({
      blocks: [],
      untimedTasks: [expect.objectContaining({
        title: 'Сверка без времени',
        occurrence: expect.objectContaining({ occursOn: '2026-08-12' }),
      })],
      loadPercent: expect.closeTo((30 / (14 * 60)) * 100),
    });
  });

  test('removes the first recurrence block when that specific instance is cancelled', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'cancel-first-task',
      title: 'Проверка перед отменой',
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    await source.saveScheduleBlock({
      id: 'cancel-first-source-block',
      taskItemId: task.id,
      occurrenceId: null,
      startsAt: '2026-08-05T09:00:00+03:00',
      endsAt: '2026-08-05T10:00:00+03:00',
      timeZoneId: null,
      createdAt: task.createdAt,
    });
    await source.saveRecurrenceSeries({
      id: 'cancel-first-series',
      itemKind: 'task',
      itemId: task.id,
      frequency: 'weekly',
      interval: 1,
      startsOn: '2026-08-05',
      createdAt: task.createdAt,
    });
    await saveOccurrenceException(source, {
      id: 'cancel-first-occurrence',
      seriesId: 'cancel-first-series',
      occursOn: '2026-08-05',
      status: 'cancelled',
      createdAt: task.createdAt,
    });

    await expect(getDayPlan(source, '2026-08-05')).resolves.toMatchObject({
      blocks: [],
      loadPercent: 0,
    });
  });

  test('shows a date-only recurring reminder on a later occurrence date', async () => {
    const source = createInMemoryDataSource();
    await source.saveReminder({
      id: 'recurring-reminder',
      title: 'Отправить недельный статус',
      remindsOn: '2026-08-05',
      periodStartOn: null,
      periodEndOn: null,
      repeatRule: { frequency: 'weekly', interval: 1 },
      estimatedDurationMinutes: null,
      completedAt: null,
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    await source.saveRecurrenceSeries({
      id: 'recurring-reminder-series',
      itemKind: 'reminder',
      itemId: 'recurring-reminder',
      frequency: 'weekly',
      interval: 1,
      startsOn: '2026-08-05',
      createdAt: '2026-08-05T08:00:00.000Z',
    });

    await expect(getDayPlan(source, '2026-08-12')).resolves.toMatchObject({
      untimedReminders: [expect.objectContaining({
        title: 'Отправить недельный статус',
        occurrence: expect.objectContaining({ occursOn: '2026-08-12' }),
      })],
    });
  });

  test('shows a moved recurring reminder only on its patched day', async () => {
    const source = createInMemoryDataSource();
    await source.saveReminder({
      id: 'moved-recurring-reminder',
      title: 'Отправить статус',
      remindsOn: '2026-08-05',
      periodStartOn: null,
      periodEndOn: null,
      repeatRule: { frequency: 'weekly', interval: 1 },
      estimatedDurationMinutes: 20,
      completedAt: null,
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    await source.saveRecurrenceSeries({
      id: 'moved-reminder-series',
      itemKind: 'reminder',
      itemId: 'moved-recurring-reminder',
      frequency: 'weekly',
      interval: 1,
      startsOn: '2026-08-05',
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    await saveOccurrenceException(source, {
      id: 'moved-reminder-occurrence',
      seriesId: 'moved-reminder-series',
      occursOn: '2026-08-12',
      status: 'active',
      reminderPatch: {
        title: 'Отправить статус позже',
        remindsOn: '2026-08-14',
        periodStartOn: null,
        periodEndOn: null,
        estimatedDurationMinutes: 25,
      },
      createdAt: '2026-08-05T08:00:00.000Z',
    });

    await expect(getDayPlan(source, '2026-08-12')).resolves.toMatchObject({
      untimedReminders: [],
    });
    await expect(getDayPlan(source, '2026-08-14')).resolves.toMatchObject({
      untimedReminders: [expect.objectContaining({
        title: 'Отправить статус позже',
        occurrence: expect.objectContaining({ occursOn: '2026-08-12' }),
      })],
    });
  });

  test('excludes a completed recurring task instance from plan and load', async () => {
    const source = createInMemoryDataSource();
    const recurringTask = await createTask(source, {
      id: 'completed-recurring-task',
      title: 'Еженедельная сверка',
      estimatedDurationMinutes: 60,
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    await source.saveTaskItem({ ...recurringTask, scheduledOn: '2026-08-05' });
    await source.saveRecurrenceSeries({
      id: 'completed-task-series',
      itemKind: 'task',
      itemId: recurringTask.id,
      frequency: 'weekly',
      interval: 1,
      startsOn: '2026-08-05',
      createdAt: recurringTask.createdAt,
    });
    await saveOccurrenceException(source, {
      id: 'completed-task-occurrence',
      seriesId: 'completed-task-series',
      occursOn: '2026-08-12',
      status: 'completed',
      completedAt: '2026-08-12T12:00:00.000Z',
      createdAt: recurringTask.createdAt,
    });

    await expect(getDayPlan(source, '2026-08-12')).resolves.toMatchObject({
      untimedTasks: [],
      blocks: [],
      loadPercent: 0,
    });
  });

  test('builds the day dashboard from persisted blocks and untimed planning items', async () => {
    const source = createInMemoryDataSource();
    const blockedTask = await createTask(source, {
      id: 'blocked-task',
      title: 'Созвон с командой',
      createdAt: '2026-08-01T08:00:00.000Z',
    });
    await source.saveTaskItem({
      ...blockedTask,
      scheduledOn: '2026-08-05',
    });
    await source.saveScheduleBlock({
      id: 'team-call',
      taskItemId: blockedTask.id,
      occurrenceId: null,
      startsAt: '2026-08-05T10:00:00+03:00',
      endsAt: '2026-08-05T11:00:00+03:00',
      timeZoneId: null,
      createdAt: blockedTask.createdAt,
    });
    const untimedTask = await createTask(source, {
      id: 'untimed-task',
      title: 'Проверить макеты',
      createdAt: '2026-08-01T08:05:00.000Z',
    });
    await source.saveTaskItem({
      ...untimedTask,
      scheduledOn: '2026-08-05',
    });
    await source.saveReminder({
      id: 'untimed-reminder',
      title: 'Отправить статус',
      remindsOn: '2026-08-05',
      periodStartOn: null,
      periodEndOn: null,
      repeatRule: null,
      estimatedDurationMinutes: null,
      completedAt: null,
      createdAt: '2026-08-01T08:10:00.000Z',
    });

    await expect(getDayPlan(source, '2026-08-05')).resolves.toMatchObject({
      loadPercent: expect.closeTo(7.142857142857143),
      tone: 'low',
      blocks: [expect.objectContaining({ title: 'Созвон с командой', startsAt: '2026-08-05T10:00:00+03:00' })],
      untimedTasks: [expect.objectContaining({ title: 'Проверить макеты' })],
      untimedReminders: [expect.objectContaining({ title: 'Отправить статус' })],
    });
  });
});
