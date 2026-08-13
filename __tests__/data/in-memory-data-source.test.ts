import type {
  AppSettings,
  CompletedItem,
  Project,
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
};

const task: TaskItem = {
  id: 'task-1',
  kind: 'task',
  projectId: project.id,
  parentTaskId: null,
  title: 'Подготовить план',
  description: null,
  scheduledOn: null,
  periodStartOn: null,
  periodEndOn: null,
  estimatedDurationMinutes: null,
  completedAt: null,
  createdAt,
};

const subtask: TaskItem = {
  id: 'subtask-1',
  kind: 'subtask',
  projectId: project.id,
  parentTaskId: task.id,
  title: 'Собрать материалы',
  description: null,
  scheduledOn: null,
  periodStartOn: null,
  periodEndOn: null,
  estimatedDurationMinutes: null,
  completedAt: null,
  createdAt,
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
};

const scheduleBlock: ScheduleBlock = {
  id: 'block-1',
  taskItemId: task.id,
  occurrenceId: null,
  startsAt: '2026-08-02T09:00:00.000Z',
  endsAt: '2026-08-02T09:30:00.000Z',
  timeZoneId: null,
  createdAt,
};

const recurrenceSeries: RecurrenceSeries = {
  id: 'recurrence-1',
  itemKind: 'task',
  itemId: task.id,
  frequency: 'weekly',
  interval: 1,
  startsOn: '2026-08-02',
  createdAt,
};

const completedItem: CompletedItem = {
  id: 'completed-1',
  taskItemId: task.id,
  completedAt: '2026-08-02T12:00:00.000Z',
  createdAt,
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

    await expect(source.getProject(project.id)).resolves.toEqual(project);
    await expect(source.getTaskItem(task.id)).resolves.toEqual(task);
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
    await source.saveCompletedItem(completedItem);
    await source.saveSettings(changedSettings);
    await source.initialize();

    await expect(source.getReminder(reminder.id)).resolves.toEqual(reminder);
    await expect(source.getScheduleBlock(scheduleBlock.id)).resolves.toEqual(
      scheduleBlock,
    );
    await expect(source.getRecurrenceSeries(recurrenceSeries.id)).resolves.toEqual(
      recurrenceSeries,
    );
    await expect(source.getCompletedItem(completedItem.id)).resolves.toEqual(
      completedItem,
    );
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
});
