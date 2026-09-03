import { clearAutonomousWorkspace } from '../../src/application/local-workspace-management';
import { createInMemoryDataSource } from '../../src/data/data-source.web';

const project = {
  id: 'project-17',
  title: 'Локальный проект',
  description: null,
  completedAt: null,
  createdAt: '2026-09-03T09:00:00.000Z',
  updatedAt: '2026-09-03T09:00:00.000Z',
  deletedAt: null,
};

describe('clearAutonomousWorkspace', () => {
  test('clears only the active autonomous replica and preserves a hidden account replica', async () => {
    const autonomous = createInMemoryDataSource();
    const account = createInMemoryDataSource();
    await autonomous.saveProject(project);
    await account.saveProject({ ...project, id: 'account-project-17' });

    await clearAutonomousWorkspace({ scope: { kind: 'autonomous' }, source: autonomous });

    await expect(autonomous.listProjects()).resolves.toEqual([]);
    await expect(account.listProjects()).resolves.toMatchObject([{ id: 'account-project-17' }]);
  });

  test('refuses to clear an account replica through the autonomous action', async () => {
    const account = createInMemoryDataSource();
    await account.saveProject(project);

    await expect(clearAutonomousWorkspace({ scope: { kind: 'account', accountId: 'account-17' }, source: account })).rejects.toThrow('autonomous');
    await expect(account.listProjects()).resolves.toMatchObject([{ id: 'project-17' }]);
  });
});
