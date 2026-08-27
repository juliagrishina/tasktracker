import { getCompletionEligibility } from '../../src/application/completion-eligibility';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { getDefaultSettings } from '../../src/data/default-settings';
import { saveTaskPlanning } from '../../src/application/planning-use-cases';

const createdAt = '2026-08-01T00:00:00.000Z';

describe('getCompletionEligibility', () => {
  test('makes a task eligible only after its last scheduled block has ended', async () => {
    const source = createInMemoryDataSource();
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow' });
    await source.saveTaskItem({ id: 'task-1', kind: 'task', projectId: null, parentTaskId: null, title: 'Подготовить отчёт', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'block-1', taskItemId: 'task-1', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-28T09:00:00+03:00', endsAt: '2026-08-28T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'block-2', taskItemId: 'task-1', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-28T11:00:00+03:00', endsAt: '2026-08-28T12:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });

    await expect(getCompletionEligibility(source, new Date('2026-08-28T07:30:00.000Z'))).resolves.toEqual([]);
    await expect(getCompletionEligibility(source, new Date('2026-08-28T09:00:00.000Z'))).resolves.toEqual([{ taskItemId: 'task-1', occurrence: null }]);
    await expect(source.getTaskItem('task-1')).resolves.toMatchObject({ completedAt: null });
  });

  test('makes a subtask eligible independently of its parent task', async () => {
    const source = createInMemoryDataSource();
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow' });
    await source.saveTaskItem({ id: 'task-1', kind: 'task', projectId: null, parentTaskId: null, title: 'Подготовить отчёт', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveTaskItem({ id: 'subtask-1', kind: 'subtask', projectId: null, parentTaskId: 'task-1', title: 'Сверить цифры', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'subtask-block', taskItemId: 'subtask-1', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-28T09:00:00+03:00', endsAt: '2026-08-28T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });

    await expect(getCompletionEligibility(source, new Date('2026-08-28T07:00:00.000Z'))).resolves.toEqual([{ taskItemId: 'subtask-1', occurrence: null }]);
  });

  test('makes only the finished recurring instance eligible', async () => {
    const source = createInMemoryDataSource();
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow' });
    await source.saveTaskItem({ id: 'task-1', kind: 'task', projectId: null, parentTaskId: null, title: 'Тренировка', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await saveTaskPlanning(source, {
      taskId: 'task-1',
      blocks: [{ id: 'block-1', taskItemId: 'task-1', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-03T09:00:00+03:00', endsAt: '2026-08-03T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null }],
      recurrence: { id: 'series-1', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt },
    });

    await expect(getCompletionEligibility(source, new Date('2026-08-10T07:00:00.000Z'))).resolves.toEqual([{
      taskItemId: 'task-1',
      occurrence: { seriesId: 'series-1', occursOn: '2026-08-10' },
    }]);
    await expect(source.listRecurrenceOccurrences('series-1')).resolves.toEqual([]);
  });
});
