import { createInMemoryDataSource } from '../../src/data/data-source.web';
import type { ScheduleBlock, TaskItem } from '../../src/domain/entities';
import { getPlanScheduleBlocks, saveOccurrenceException, saveTaskPlanning } from '../../src/application/planning-use-cases';

const createdAt = '2026-08-01T00:00:00.000Z';
const task: TaskItem = { id: 'task-1', kind: 'task', projectId: null, parentTaskId: null, title: 'План', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null };
const block: ScheduleBlock = { id: 'block-1', taskItemId: task.id, occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-03T09:00:00+03:00', endsAt: '2026-08-03T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null };

describe('planning use cases', () => {
  test('does not persist a conflicting block until the user resolves it', async () => {
    const source = createInMemoryDataSource(); await source.saveTaskItem(task); await source.saveScheduleBlock(block);
    await expect(saveTaskPlanning(source, { taskId: task.id, blocks: [{ ...block, id: 'conflict', startsAt: '2026-08-03T09:30:00+03:00', endsAt: '2026-08-03T10:30:00+03:00' }], recurrence: undefined })).resolves.toMatchObject({ conflict: expect.any(Array) });
    await expect(source.getScheduleBlock('conflict')).resolves.toBeNull();
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
});
