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
      createdAt: task.createdAt,
    });

    await expect(getPlanLoadDays(source, '2026-08-05', 'week'))
      .resolves.toContainEqual(expect.objectContaining({
        isoDate: '2026-08-05',
        loadPercent: 107.14285714285714,
        tone: 'high',
      }));
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
