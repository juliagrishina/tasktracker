import { completeBacklogItem, createTask, resumeBacklogItem } from '../../src/application/backlog-use-cases';
import { getCompletedItems } from '../../src/application/completed-use-cases';
import { saveTaskPlanning, setRecurrenceOccurrenceState } from '../../src/application/planning-use-cases';
import { createInMemoryDataSource } from '../../src/data/data-source.web';

const createdAt = '2026-08-01T08:00:00.000Z';

describe('completed use cases', () => {
  test('lists real completed tasks and individual recurring occurrences', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, { id: 'task-1', title: 'Подготовить отчёт', createdAt });
    await completeBacklogItem(source, { kind: 'task', id: task.id, completedAt: '2026-08-02T10:00:00.000Z' });
    const recurring = await createTask(source, { id: 'task-2', title: 'Еженедельный обзор', createdAt });
    await saveTaskPlanning(source, {
      taskId: recurring.id,
      blocks: [],
      placement: { scheduledOn: '2026-08-03', periodStartOn: null, periodEndOn: null },
      recurrence: { id: 'series-1', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt },
    });
    await setRecurrenceOccurrenceState(source, 'series-1', '2026-08-10', 'completed', undefined, new Date('2026-08-10T12:00:00.000Z'));

    await expect(getCompletedItems(source)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'task-1', kind: 'task', title: 'Подготовить отчёт', occurrence: null }),
      expect.objectContaining({ id: 'recurrence:series-1:2026-08-10', kind: 'task', title: 'Еженедельный обзор', occurrence: { seriesId: 'series-1', occursOn: '2026-08-10' } }),
    ]));
  });

  test('resumes a completed task without removing its existing plan', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, { id: 'task-1', title: 'Подготовить отчёт', createdAt });
    await source.saveScheduleBlock({ id: 'block-1', taskItemId: task.id, occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-03T10:00:00+03:00', endsAt: '2026-08-03T11:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    await completeBacklogItem(source, { kind: 'task', id: task.id, completedAt: '2026-08-02T10:00:00.000Z' });

    await resumeBacklogItem(source, { kind: 'task', id: task.id });

    await expect(source.getTaskItem(task.id)).resolves.toMatchObject({ completedAt: null });
    await expect(source.getScheduleBlock('block-1')).resolves.toMatchObject({ taskItemId: task.id });
  });
});
