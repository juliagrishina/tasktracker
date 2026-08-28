import { loadPlanReadModel } from '../../src/application/plan-read-model';
import { getDefaultSettings } from '../../src/data/default-settings';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { getPlanScheduleBlocks, getPlanUntimedReminders, getPlanUntimedTasks } from '../../src/application/planning-use-cases';

describe('plan read model', () => {
  test('keeps a completed scheduled task in the selected day load', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'completed-planned-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Завершённое дело', description: null, estimatedDurationMinutes: null, completedAt: '2026-08-05T10:00:00.000Z', createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'completed-planned-block', taskItemId: 'completed-planned-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-05T09:00:00+03:00', endsAt: '2026-08-05T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });

    const model = await loadPlanReadModel({
      getPlanScheduleBlocks: (date) => getPlanScheduleBlocks(source, date),
      getPlanUntimedReminders: (date) => getPlanUntimedReminders(source, date),
      getPlanUntimedTasks: (date) => getPlanUntimedTasks(source, date),
      getTaskItem: (taskId) => source.getTaskItem(taskId),
    }, getDefaultSettings(), ['2026-08-05']);

    expect(model.byDate['2026-08-05'].blocks).toHaveLength(1);
    expect(model.byDate['2026-08-05'].taskById.get('completed-planned-task')).toMatchObject({ completedAt: '2026-08-05T10:00:00.000Z' });
    expect(model.byDate['2026-08-05'].loadPercent).toBeCloseTo(7.142857142857143);
  });

  test('provides blocks, linked task titles and the same load calculation for every requested day', async () => {
    const source = createInMemoryDataSource();
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'planned-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Подготовить демо', description: null, estimatedDurationMinutes: 60, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'planned-block', taskItemId: 'planned-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-05T09:00:00+03:00', endsAt: '2026-08-05T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveTaskItem({ id: 'date-only-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Прочитать отчёт', description: null, estimatedDurationMinutes: 120, scheduledOn: '2026-08-06', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });

    const model = await loadPlanReadModel({
      getPlanScheduleBlocks: (date) => getPlanScheduleBlocks(source, date),
      getPlanUntimedReminders: (date) => getPlanUntimedReminders(source, date),
      getPlanUntimedTasks: (date) => getPlanUntimedTasks(source, date),
      getTaskItem: (taskId) => source.getTaskItem(taskId),
    }, getDefaultSettings(), ['2026-08-05', '2026-08-06']);

    expect(model.byDate['2026-08-05']).toMatchObject({ loadPercent: expect.closeTo(100 / 14) });
    expect(model.byDate['2026-08-05'].blocks).toHaveLength(1);
    expect(model.byDate['2026-08-05'].taskById.get('planned-task')).toMatchObject({ title: 'Подготовить демо' });
    expect(model.byDate['2026-08-06']).toMatchObject({ loadPercent: expect.closeTo(200 / 14) });
    expect(model.byDate['2026-08-06'].untimedTasks).toHaveLength(1);
  });
});
