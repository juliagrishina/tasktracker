import type { Project, TaskItem } from '../../src/domain/entities';
import { createInMemoryDataSource } from '../../src/data/data-source.web';

const createdAt = '2026-08-02T09:00:00.000Z';

const project: Project = {
  id: 'project-1',
  title: 'Личный проект',
  description: 'Описание',
  completedAt: null,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
};

const task: TaskItem = {
  id: 'task-1',
  kind: 'task',
  projectId: null,
  parentTaskId: null,
  title: 'Разобрать заметки',
  description: null,
  estimatedDurationMinutes: 30,
  completedAt: null,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
};

describe('backlog data source', () => {
  test('lists saved projects and task items in creation order', async () => {
    const source = createInMemoryDataSource();

    await source.saveProject(project);
    await source.saveTaskItem(task);

    await expect(source.listProjects()).resolves.toEqual([
      { ...project, updatedAt: expect.any(String) },
    ]);
    await expect(source.listTaskItems()).resolves.toEqual([
      { ...task, updatedAt: expect.any(String) },
    ]);
  });
});
