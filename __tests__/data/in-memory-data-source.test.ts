import type {
  AppSettings,
  Project,
  RecurrenceOccurrence,
  RecurrenceSeries,
  Reminder,
  ScheduleBlock,
  TaskItem,
} from '../../src/domain/entities';
import { createInMemoryDataSource } from '../../src/data/data-source.web';

const createdAt = '2026-08-01T08:00:00.000Z';

const project: Project = {
  id: 'project-1',
  title: 'Личный проект',
  description: null,
  completedAt: null,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
};

const task: TaskItem = {
  id: 'task-1',
  kind: 'task',
  projectId: project.id,
  parentTaskId: null,
  title: 'Подготовить план',
  description: null,
  estimatedDurationMinutes: null,
  completedAt: null,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
};

const subtask: TaskItem = {
  id: 'subtask-1',
  kind: 'subtask',
  projectId: project.id,
  parentTaskId: task.id,
  title: 'Собрать материалы',
  description: null,
  estimatedDurationMinutes: null,
  completedAt: null,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
};

const reminder: Reminder = {
  id: 'reminder-1',
  title: 'Позвонить в страховую',
  remindsOn: '2026-08-02',
  periodStartOn: null,
  periodEndOn: null,
  repeatRule: null,
  estimatedDurationMinutes: null,
  completedAt: null,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
};

const scheduleBlock: ScheduleBlock = {
  id: 'block-1',
  taskItemId: task.id,
  occurrenceId: null,
  timeZoneId: null,
  startsAt: '2026-08-02T09:00:00.000Z',
  endsAt: '2026-08-02T09:30:00.000Z',
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
};

const recurrenceSeries: RecurrenceSeries = {
  id: 'recurrence-1',
  itemKind: 'task',
  itemId: task.id,
  frequency: 'weekly',
  interval: 1,
  startsOn: '2026-08-02',
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
};

const reminderRecurrenceSeries: RecurrenceSeries = {
  id: 'reminder-recurrence-1',
  itemKind: 'reminder',
  itemId: reminder.id,
  frequency: 'weekly',
  interval: 1,
  startsOn: '2026-08-02',
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
};

const recurrenceOccurrence: RecurrenceOccurrence = {
  id: 'occurrence-1',
  seriesId: recurrenceSeries.id,
  occursOn: '2026-08-09',
  cancelledAt: null,
  completedAt: null,
  blocksOverridden: false,
  taskPatch: null,
  reminderPatch: null,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
};

const changedSettings: AppSettings = {
  workdayStartsAt: '08:00',
  workdayEndsAt: '22:00',
  eveningReviewAt: '21:00',
  notificationLeadMinutes: 15,
};

describe('in-memory data source', () => {
  test('creates default settings only once', async () => {
    const source = createInMemoryDataSource();

    await source.initialize();
    await source.initialize();

    await expect(source.getSettings()).resolves.toMatchObject({
      workdayStartsAt: '08:00',
      workdayEndsAt: '22:00',
      eveningReviewAt: '21:00',
      notificationLeadMinutes: 10,
    });
    expect(source.debugSettingsRowCount()).toBe(1);
  });

  test('returns a saved project and task after reinitialization', async () => {
    const source = createInMemoryDataSource();

    await source.initialize();
    await source.saveProject(project);
    await source.saveTaskItem(task);
    await source.initialize();

    await expect(source.getProject(project.id)).resolves.toEqual({
      ...project,
      updatedAt: expect.any(String),
    });
    await expect(source.getTaskItem(task.id)).resolves.toEqual({
      ...task,
      updatedAt: expect.any(String),
    });
  });

  test('preserves every entity and changed settings after reinitialization', async () => {
    const source = createInMemoryDataSource();

    await source.initialize();
    await source.saveProject(project);
    await source.saveTaskItem(task);
    await source.saveTaskItem(subtask);
    await source.saveReminder(reminder);
    await source.saveScheduleBlock(scheduleBlock);
    await source.saveRecurrenceSeries(recurrenceSeries);
    await source.saveSettings(changedSettings);
    await source.initialize();

    await expect(source.getReminder(reminder.id)).resolves.toEqual({
      ...reminder,
      updatedAt: expect.any(String),
    });
    await expect(source.getScheduleBlock(scheduleBlock.id)).resolves.toEqual({
      ...scheduleBlock,
      updatedAt: expect.any(String),
    });
    await expect(source.getRecurrenceSeries(recurrenceSeries.id)).resolves.toEqual({
      ...recurrenceSeries,
      updatedAt: expect.any(String),
    });
    await expect(source.getSettings()).resolves.toEqual(changedSettings);
  });

  test('rejects a subtask whose stored parent is another subtask', async () => {
    const source = createInMemoryDataSource();
    const nestedSubtask: TaskItem = {
      ...subtask,
      id: 'subtask-2',
      kind: 'subtask',
      parentTaskId: subtask.id,
    };

    await source.saveProject(project);
    await source.saveTaskItem(task);
    await source.saveTaskItem(subtask);

    await expect(source.saveTaskItem(nestedSubtask)).rejects.toThrow(
      'Родителем подзадачи может быть только задача',
    );
  });

  test('soft-deletes a task, its subtask, and their related schedule block and recurrence series', async () => {
    const source = createInMemoryDataSource();

    await source.saveTaskItem(task);
    await source.saveTaskItem(subtask);
    await source.saveScheduleBlock(scheduleBlock);
    await source.saveRecurrenceSeries(recurrenceSeries);

    await source.deleteTaskItem(task.id);

    await expect(source.getTaskItem(task.id)).resolves.toBeNull();
    expect(source.debugRowExists(task.id)).toBe(true);

    await expect(source.getTaskItem(subtask.id)).resolves.toBeNull();
    expect(source.debugRowExists(subtask.id)).toBe(true);

    await expect(source.getScheduleBlock(scheduleBlock.id)).resolves.toBeNull();
    expect(source.debugRowExists(scheduleBlock.id)).toBe(true);

    await expect(source.getRecurrenceSeries(recurrenceSeries.id)).resolves.toBeNull();
    expect(source.debugRowExists(recurrenceSeries.id)).toBe(true);
  });

  test('rejects creating a subtask whose parent task was soft-deleted', async () => {
    const source = createInMemoryDataSource();

    await source.saveTaskItem(task);
    await source.deleteTaskItem(task.id);

    await expect(source.saveTaskItem(subtask)).rejects.toThrow(
      'Задача-родитель подзадачи не найдена',
    );
  });

  test('rejects a recurrence series whose task item does not exist', async () => {
    const source = createInMemoryDataSource();

    await expect(source.saveRecurrenceSeries(recurrenceSeries)).rejects.toThrow(
      'Задача для серии повторения не найдена',
    );
  });

  test('rejects a recurrence series whose task item was soft-deleted', async () => {
    const source = createInMemoryDataSource();

    await source.saveTaskItem(task);
    await source.deleteTaskItem(task.id);

    await expect(source.saveRecurrenceSeries(recurrenceSeries)).rejects.toThrow(
      'Задача для серии повторения не найдена',
    );
  });

  test('persists an active reminder recurrence and an independently completed occurrence', async () => {
    const source = createInMemoryDataSource();

    await source.saveReminder(reminder);
    await source.saveRecurrenceSeries(reminderRecurrenceSeries);
    await (source as unknown as {
      saveRecurrenceOccurrence: (occurrence: typeof recurrenceOccurrence) => Promise<void>;
      getRecurrenceOccurrence: (id: string) => Promise<typeof recurrenceOccurrence | null>;
    }).saveRecurrenceOccurrence({
      ...recurrenceOccurrence,
      seriesId: reminderRecurrenceSeries.id,
      completedAt: '2026-08-09T10:00:00.000Z',
    });

    await expect((source as unknown as {
      getRecurrenceOccurrence: (id: string) => Promise<typeof recurrenceOccurrence | null>;
    }).getRecurrenceOccurrence(recurrenceOccurrence.id)).resolves.toMatchObject({
      completedAt: '2026-08-09T10:00:00.000Z',
      cancelledAt: null,
      deletedAt: null,
    });
  });

  test('soft-deletes a reminder recurrence and occurrence with its reminder', async () => {
    const source = createInMemoryDataSource();

    await source.saveReminder(reminder);
    await source.saveRecurrenceSeries(reminderRecurrenceSeries);
    await (source as unknown as {
      saveRecurrenceOccurrence: (occurrence: typeof recurrenceOccurrence) => Promise<void>;
      getRecurrenceSeries: (id: string) => Promise<RecurrenceSeries | null>;
      getRecurrenceOccurrence: (id: string) => Promise<typeof recurrenceOccurrence | null>;
    }).saveRecurrenceOccurrence({
      ...recurrenceOccurrence,
      seriesId: reminderRecurrenceSeries.id,
    });

    await source.deleteReminder(reminder.id);

    await expect((source as unknown as {
      getRecurrenceSeries: (id: string) => Promise<RecurrenceSeries | null>;
    }).getRecurrenceSeries(reminderRecurrenceSeries.id)).resolves.toBeNull();
    await expect((source as unknown as {
      getRecurrenceOccurrence: (id: string) => Promise<typeof recurrenceOccurrence | null>;
    }).getRecurrenceOccurrence(recurrenceOccurrence.id)).resolves.toBeNull();
  });

  test('rejects a second live occurrence for one series date', async () => {
    const source = createInMemoryDataSource();

    await source.saveTaskItem(task);
    await source.saveRecurrenceSeries(recurrenceSeries);
    const planningSource = source as unknown as {
      saveRecurrenceOccurrence: (occurrence: typeof recurrenceOccurrence) => Promise<void>;
    };
    await planningSource.saveRecurrenceOccurrence(recurrenceOccurrence);

    await expect(planningSource.saveRecurrenceOccurrence({
      ...recurrenceOccurrence,
      id: 'occurrence-duplicate',
    })).rejects.toThrow(/экземпляр/i);
  });

  test('soft-deletes exact blocks belonging to a deleted recurrence occurrence', async () => {
    const source = createInMemoryDataSource();
    const occurrenceBlock: ScheduleBlock = {
      ...scheduleBlock,
      id: 'occurrence-block-1',
      occurrenceId: recurrenceOccurrence.id,
    };

    await source.saveTaskItem(task);
    await source.saveRecurrenceSeries(recurrenceSeries);
    await source.saveRecurrenceOccurrence(recurrenceOccurrence);
    await source.saveScheduleBlock(occurrenceBlock);
    await source.deleteRecurrenceOccurrence(recurrenceOccurrence.id);

    await expect(source.getScheduleBlock(occurrenceBlock.id)).resolves.toBeNull();
  });
});
