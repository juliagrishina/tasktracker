import { completeBacklogItem, createReminder, createTask, resumeBacklogItem } from '../../src/application/backlog-use-cases';
import { getCompletedItemDetails, getCompletedItems, permanentlyDeleteCompletedItem } from '../../src/application/completed-use-cases';
import { saveTaskPlanning, setRecurrenceOccurrenceState, syncReminderRecurrence } from '../../src/application/planning-use-cases';
import { getDefaultSettings } from '../../src/data/default-settings';
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

  test('lists completed standalone and recurring reminders', async () => {
    const source = createInMemoryDataSource();
    const standalone = await createReminder(source, { id: 'reminder-1', title: 'Отправить документы', createdAt });
    await completeBacklogItem(source, { kind: 'reminder', id: standalone.id, completedAt: '2026-08-02T10:00:00.000Z' });
    const recurring = await createReminder(source, {
      id: 'reminder-2',
      title: 'Полить цветы',
      remindsOn: '2026-08-03',
      repeatRule: { frequency: 'weekly', interval: 1 },
      createdAt,
    });
    await syncReminderRecurrence(source, recurring.id);
    const series = (await source.listRecurrenceSeries()).find((candidate) => candidate.itemId === recurring.id);
    expect(series).toBeDefined();
    await setRecurrenceOccurrenceState(source, series!.id, '2026-08-10', 'completed', undefined, new Date('2026-08-10T12:00:00.000Z'));

    await expect(getCompletedItems(source)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: standalone.id, kind: 'reminder', title: 'Отправить документы', occurrence: null }),
      expect.objectContaining({ id: `recurrence:${series!.id}:2026-08-10`, kind: 'reminder', title: 'Полить цветы', occurrence: { seriesId: series!.id, occursOn: '2026-08-10' } }),
    ]));
  });

  test('filters archive periods by calendar dates in the saved timezone', async () => {
    const source = createInMemoryDataSource();
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'America/Los_Angeles', timeZoneMode: 'manual' });
    const localDecember = await createTask(source, { id: 'task-december', title: 'Завершено 31 декабря', createdAt });
    const localJanuary = await createTask(source, { id: 'task-january', title: 'Завершено 1 января', createdAt });
    await completeBacklogItem(source, { kind: 'task', id: localDecember.id, completedAt: '2026-01-01T00:30:00.000Z' });
    await completeBacklogItem(source, { kind: 'task', id: localJanuary.id, completedAt: '2026-01-01T08:30:00.000Z' });
    const now = new Date('2026-01-01T01:00:00.000Z');

    await expect(getCompletedItems(source, { now, period: 'today' })).resolves.toMatchObject([{ id: localDecember.id }]);
    await expect(getCompletedItems(source, { now, period: 'month' })).resolves.toMatchObject([{ id: localDecember.id }]);
    await expect(getCompletedItems(source, { now, period: 'year' })).resolves.toMatchObject([{ id: localDecember.id }]);
    await expect(getCompletedItems(source, { now, period: 'week' })).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: localDecember.id }),
      expect.objectContaining({ id: localJanuary.id }),
    ]));
  });

  test('returns read-only details with the source description and hierarchy for each completed kind', async () => {
    const source = createInMemoryDataSource();
    const completedAt = '2026-08-20T10:00:00.000Z';
    await source.saveProject({ id: 'project-1', title: 'Запуск приложения', description: 'Описание проекта', completedAt, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveTaskItem({ id: 'parent-task', kind: 'task', projectId: 'project-1', parentTaskId: null, title: 'Подготовить релиз', description: 'Описание задачи', estimatedDurationMinutes: null, completedAt, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveTaskItem({ id: 'subtask-1', kind: 'subtask', projectId: 'project-1', parentTaskId: 'parent-task', title: 'Проверить сборку', description: 'Описание подзадачи', estimatedDurationMinutes: null, completedAt, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveReminder({ id: 'reminder-1', title: 'Напомнить о релизе', linkedTaskItemId: 'parent-task', linkedOccurrenceOn: null, remindsOn: null, periodStartOn: null, periodEndOn: null, repeatRule: null, estimatedDurationMinutes: null, completedAt, createdAt, updatedAt: createdAt, deletedAt: null });

    await expect(getCompletedItemDetails(source, { id: 'project-1', kind: 'project', title: 'Запуск приложения', completedAt, occurrence: null })).resolves.toMatchObject({
      typeLabel: 'Проект', description: 'Описание проекта', relation: null,
    });
    await expect(getCompletedItemDetails(source, { id: 'parent-task', kind: 'task', title: 'Подготовить релиз', completedAt, occurrence: null })).resolves.toMatchObject({
      typeLabel: 'Задача', description: 'Описание задачи', relation: { label: 'Проект', title: 'Запуск приложения' },
    });
    await expect(getCompletedItemDetails(source, { id: 'subtask-1', kind: 'subtask', title: 'Проверить сборку', completedAt, occurrence: null })).resolves.toMatchObject({
      typeLabel: 'Подзадача', description: 'Описание подзадачи', relation: { label: 'Родительская задача', title: 'Подготовить релиз' },
    });
    await expect(getCompletedItemDetails(source, { id: 'reminder-1', kind: 'reminder', title: 'Напомнить о релизе', completedAt, occurrence: null })).resolves.toMatchObject({
      typeLabel: 'Напоминание', description: null, relation: { label: 'Связанная задача', title: 'Подготовить релиз' },
    });
  });

  test('returns the occurrence context and overridden description for a completed recurring task', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, { id: 'recurring-task', title: 'Еженедельный обзор', description: 'Базовое описание', createdAt });
    await saveTaskPlanning(source, {
      taskId: task.id,
      blocks: [],
      placement: { scheduledOn: '2026-08-03', periodStartOn: null, periodEndOn: null },
      recurrence: { id: 'series-details', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt },
    });
    await source.saveRecurrenceOccurrence({ id: 'occurrence-details', seriesId: 'series-details', occursOn: '2026-08-10', cancelledAt: null, completedAt: '2026-08-10T12:00:00.000Z', blocksOverridden: false, taskPatch: { description: 'Описание этого экземпляра' }, reminderPatch: null, createdAt, updatedAt: createdAt, deletedAt: null });

    await expect(getCompletedItemDetails(source, { id: 'recurrence:series-details:2026-08-10', taskId: task.id, kind: 'task', title: 'Еженедельный обзор', completedAt: '2026-08-10T12:00:00.000Z', occurrence: { seriesId: 'series-details', occursOn: '2026-08-10' } })).resolves.toMatchObject({
      description: 'Описание этого экземпляра',
      completionContext: 'Экземпляр серии от 2026-08-10',
    });
  });

  test('permanently deletes only the selected completed recurrence occurrence from the archive', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, { id: 'delete-occurrence-task', title: 'Еженедельный обзор', createdAt });
    await saveTaskPlanning(source, {
      taskId: task.id,
      blocks: [],
      placement: { scheduledOn: '2026-08-03', periodStartOn: null, periodEndOn: null },
      recurrence: { id: 'delete-occurrence-series', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt },
    });
    await source.saveRecurrenceOccurrence({ id: 'delete-occurrence-first', seriesId: 'delete-occurrence-series', occursOn: '2026-08-10', cancelledAt: null, completedAt: '2026-08-10T12:00:00.000Z', blocksOverridden: false, taskPatch: null, reminderPatch: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveRecurrenceOccurrence({ id: 'delete-occurrence-second', seriesId: 'delete-occurrence-series', occursOn: '2026-08-17', cancelledAt: null, completedAt: '2026-08-17T12:00:00.000Z', blocksOverridden: false, taskPatch: null, reminderPatch: null, createdAt, updatedAt: createdAt, deletedAt: null });

    await permanentlyDeleteCompletedItem(source, { id: 'recurrence:delete-occurrence-series:2026-08-10', taskId: task.id, kind: 'task', title: task.title, completedAt: '2026-08-10T12:00:00.000Z', occurrence: { seriesId: 'delete-occurrence-series', occursOn: '2026-08-10' } });

    await expect(getCompletedItems(source)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'recurrence:delete-occurrence-series:2026-08-17' }),
    ]));
    await expect(getCompletedItems(source)).resolves.not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'recurrence:delete-occurrence-series:2026-08-10' }),
    ]));
    await expect(source.getTaskItem(task.id)).resolves.toMatchObject({ id: task.id });
  });

  test('refuses permanent deletion when the completed archive entry no longer exists', async () => {
    const source = createInMemoryDataSource();

    await expect(permanentlyDeleteCompletedItem(source, { id: 'missing-task', kind: 'task', title: 'Несуществующая задача', completedAt: '2026-08-20T10:00:00.000Z', occurrence: null })).rejects.toThrow('Можно удалить только завершённый элемент');
  });
});
