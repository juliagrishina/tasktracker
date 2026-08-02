import type { Project, TaskItem } from '../../src/domain/entities';
import { createInMemoryDataSource } from '../../src/data/data-source.web';

const createdAt = '2026-08-01T08:00:00.000Z';

const project: Project = {
  id: 'project-1',
  title: 'Личный проект',
  createdAt,
};

const task: TaskItem = {
  id: 'task-1',
  kind: 'task',
  projectId: project.id,
  parentTaskId: null,
  title: 'Подготовить план',
  createdAt,
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
});
