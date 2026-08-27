import {
  completeBacklogItem,
  createProject,
  createReminder,
  createSubtask,
  createTask,
  deleteBacklogItem,
  getBacklogView,
  moveTaskToProject,
  updateProject,
  updateReminder,
  updateTaskItem,
} from '../../src/application/backlog-use-cases';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import type { LocalNotificationScheduler } from '../../src/application/notification-scheduling';

const createdAt = '2026-08-02T09:00:00.000Z';
const completedAt = '2026-08-02T18:00:00.000Z';

describe('backlog use cases', () => {
  test('creates a project, unassigned task, project task and reminder with only a title', async () => {
    const source = createInMemoryDataSource();

    const project = await createProject(source, {
      id: 'project-1',
      title: 'Личный проект',
      createdAt,
    });
    const unassignedTask = await createTask(source, {
      id: 'task-1',
      title: 'Разобрать заметки',
      createdAt,
    });
    const projectTask = await createTask(source, {
      id: 'task-2',
      title: 'Собрать документы',
      projectId: project.id,
      createdAt,
    });
    const reminder = await createReminder(source, {
      id: 'reminder-1',
      title: 'Проверить ответ',
      createdAt,
    });

    expect(project.description).toBeNull();
    expect(unassignedTask.projectId).toBeNull();
    expect(projectTask.projectId).toBe(project.id);
    expect(reminder.remindsOn).toBeNull();
  });

  test('returns reminders, unassigned tasks and projects in the approved order', async () => {
    const source = createInMemoryDataSource();
    const project = await createProject(source, {
      id: 'project-1',
      title: 'Работа',
      createdAt,
    });
    await createReminder(source, { id: 'reminder-1', title: 'Позвонить', createdAt });
    await createTask(source, { id: 'task-1', title: 'Разобрать входящие', createdAt });
    await createTask(source, {
      id: 'task-2',
      title: 'Подготовить отчёт',
      projectId: project.id,
      createdAt,
    });

    const view = await getBacklogView(source);

    expect(view.categoryOrder).toEqual(['reminders', 'unassigned', 'projects']);
    expect(view.reminders.map((item) => item.title)).toEqual(['Позвонить']);
    expect(view.unassignedTasks.map((item) => item.task.title)).toEqual([
      'Разобрать входящие',
    ]);
    expect(view.projects.map((item) => item.project.title)).toEqual(['Работа']);
  });

  test('moves a task with its subtask to a project and back', async () => {
    const source = createInMemoryDataSource();
    const project = await createProject(source, {
      id: 'project-1',
      title: 'Дом',
      createdAt,
    });
    const task = await createTask(source, {
      id: 'task-1',
      title: 'Разобрать вещи',
      description: 'До вечера',
      estimatedDurationMinutes: 45,
      createdAt,
    });
    const subtask = await createSubtask(source, {
      id: 'subtask-1',
      parentTaskId: task.id,
      title: 'Подготовить коробки',
      createdAt,
    });

    await moveTaskToProject(source, { taskId: task.id, projectId: project.id });
    await moveTaskToProject(source, { taskId: task.id, projectId: null });

    await expect(source.getTaskItem(task.id)).resolves.toMatchObject({
      projectId: null,
      description: 'До вечера',
      estimatedDurationMinutes: 45,
    });
    await expect(source.getTaskItem(subtask.id)).resolves.toMatchObject({
      projectId: null,
    });
  });

  test('completes a project with all of its tasks and subtasks', async () => {
    const source = createInMemoryDataSource();
    const project = await createProject(source, {
      id: 'project-1',
      title: 'Ремонт',
      createdAt,
    });
    const task = await createTask(source, {
      id: 'task-1',
      title: 'Купить материалы',
      projectId: project.id,
      createdAt,
    });
    const subtask = await createSubtask(source, {
      id: 'subtask-1',
      parentTaskId: task.id,
      title: 'Составить список',
      createdAt,
    });

    await completeBacklogItem(source, {
      kind: 'project',
      id: project.id,
      completedAt,
    });

    await expect(source.getProject(project.id)).resolves.toMatchObject({ completedAt });
    await expect(source.getTaskItem(task.id)).resolves.toMatchObject({ completedAt });
    await expect(source.getTaskItem(subtask.id)).resolves.toMatchObject({ completedAt });
  });

  test('completes a task with its direct subtasks while keeping unrelated tasks active', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'task-1',
      title: 'Подготовить поездку',
      createdAt,
    });
    const subtask = await createSubtask(source, {
      id: 'subtask-1',
      parentTaskId: task.id,
      title: 'Собрать документы',
      createdAt,
    });
    const unrelatedTask = await createTask(source, {
      id: 'task-2',
      title: 'Полить цветы',
      createdAt,
    });

    await completeBacklogItem(source, {
      kind: 'task',
      id: task.id,
      completedAt,
    });

    await expect(source.getTaskItem(task.id)).resolves.toMatchObject({ completedAt });
    await expect(source.getTaskItem(subtask.id)).resolves.toMatchObject({ completedAt });
    await expect(source.getTaskItem(unrelatedTask.id)).resolves.toMatchObject({
      completedAt: null,
    });
  });

  test('cancels a task notification before marking the task complete', async () => {
    const source = createInMemoryDataSource();
    const scheduler: LocalNotificationScheduler = {
      schedule: jest.fn(),
      cancel: jest.fn(),
    };
    const task = await createTask(source, {
      id: 'notification-task',
      title: 'Подготовить отчёт',
      createdAt,
    });
    await source.saveScheduleBlock({
      id: 'notification-block',
      taskItemId: task.id,
      occurrenceId: null,
      notificationId: 'notification-1',
      timeZoneId: 'Europe/Moscow',
      startsAt: '2026-09-01T10:00:00+03:00',
      endsAt: '2026-09-01T11:00:00+03:00',
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    });

    await completeBacklogItem(source, { kind: 'task', id: task.id, completedAt }, scheduler);

    expect(scheduler.cancel).toHaveBeenCalledWith('notification-1');
  });

  test('edits only supplied fields and turns an empty description into null', async () => {
    const source = createInMemoryDataSource();
    const project = await createProject(source, {
      id: 'project-1',
      title: 'Личный',
      description: 'Старое описание',
      createdAt,
    });
    const task = await createTask(source, {
      id: 'task-1',
      title: 'Подготовить список',
      description: 'Черновик',
      estimatedDurationMinutes: 30,
      createdAt,
    });
    const reminder = await createReminder(source, {
      id: 'reminder-1',
      title: 'Проверить письмо',
      estimatedDurationMinutes: 10,
      createdAt,
    });

    await updateProject(source, { id: project.id, description: '  ' });
    await updateTaskItem(source, { id: task.id, title: '  Подготовить план  ' });
    await updateReminder(source, { id: reminder.id, remindsOn: '2026-08-03' });

    await expect(source.getProject(project.id)).resolves.toMatchObject({
      title: 'Личный',
      description: null,
    });
    await expect(source.getTaskItem(task.id)).resolves.toMatchObject({
      title: 'Подготовить план',
      description: 'Черновик',
      estimatedDurationMinutes: 30,
    });
    await expect(source.getReminder(reminder.id)).resolves.toMatchObject({
      remindsOn: '2026-08-03',
      estimatedDurationMinutes: 10,
    });
  });

  test('keeps the first completion date and requires deletion confirmation', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'task-1',
      title: 'Отправить сообщение',
      createdAt,
    });

    await completeBacklogItem(source, {
      kind: 'task',
      id: task.id,
      completedAt,
    });
    await completeBacklogItem(source, {
      kind: 'task',
      id: task.id,
      completedAt: '2026-08-03T10:00:00.000Z',
    });

    await expect(
      deleteBacklogItem(source, { kind: 'task', id: task.id, confirmed: false }),
    ).rejects.toThrow('Требуется подтверждение удаления');
    await expect(source.getTaskItem(task.id)).resolves.toMatchObject({ completedAt });
  });

  test('deleting a project leaves its task unassigned', async () => {
    const source = createInMemoryDataSource();
    const project = await createProject(source, {
      id: 'project-1',
      title: 'Покупки',
      createdAt,
    });
    const task = await createTask(source, {
      id: 'task-1',
      title: 'Купить продукты',
      projectId: project.id,
      createdAt,
    });

    await deleteBacklogItem(source, {
      kind: 'project',
      id: project.id,
      confirmed: true,
    });

    await expect(source.getProject(project.id)).resolves.toBeNull();
    await expect(source.getTaskItem(task.id)).resolves.toMatchObject({ projectId: null });
  });

  test('deleting a task also soft-deletes its subtask and both disappear from the backlog', async () => {
    const source = createInMemoryDataSource();
    const task = await createTask(source, {
      id: 'task-1',
      title: 'Организовать переезд',
      createdAt,
    });
    const subtask = await createSubtask(source, {
      id: 'subtask-1',
      parentTaskId: task.id,
      title: 'Заказать коробки',
      createdAt,
    });

    await deleteBacklogItem(source, { kind: 'task', id: task.id, confirmed: true });

    await expect(source.getTaskItem(task.id)).resolves.toBeNull();
    await expect(source.getTaskItem(subtask.id)).resolves.toBeNull();

    const view = await getBacklogView(source);
    expect(view.unassignedTasks).toEqual([]);
  });

  test('cancels a task notification before deleting the task', async () => {
    const source = createInMemoryDataSource();
    const scheduler: LocalNotificationScheduler = {
      schedule: jest.fn(),
      cancel: jest.fn(),
    };
    const task = await createTask(source, {
      id: 'delete-notification-task',
      title: 'Перенести встречу',
      createdAt,
    });
    await source.saveScheduleBlock({
      id: 'delete-notification-block',
      taskItemId: task.id,
      occurrenceId: null,
      notificationId: 'notification-2',
      timeZoneId: 'Europe/Moscow',
      startsAt: '2026-09-01T10:00:00+03:00',
      endsAt: '2026-09-01T11:00:00+03:00',
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    });

    await deleteBacklogItem(source, { kind: 'task', id: task.id, confirmed: true }, scheduler);

    expect(scheduler.cancel).toHaveBeenCalledWith('notification-2');
  });
});
