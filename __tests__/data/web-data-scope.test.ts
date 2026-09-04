import {
  createDataSource,
  createPersistentBrowserDataSource,
} from '../../src/data/data-source.web';
import type { Project } from '../../src/domain/entities';
import { isUuid } from '../../src/domain/uuid';

interface SyncStatusSource {
  getLastSyncSuccessAt(): Promise<string | null>;
  recordSyncSuccess(at: string): Promise<void>;
}

const project: Project = {
  id: 'autonomous-project',
  title: 'Автономный проект',
  description: null,
  completedAt: null,
  createdAt: '2026-09-02T08:00:00.000Z',
  updatedAt: '2026-09-02T08:00:00.000Z',
  deletedAt: null,
};

describe('web scoped data sources', () => {
  test('isolates account data from the autonomous area and reopens the same account area', async () => {
    const autonomousSource = createDataSource({ kind: 'autonomous' });
    await autonomousSource.saveProject(project);

    const accountSource = createDataSource({ kind: 'account', accountId: 'account-a' });
    await expect(accountSource.listProjects()).resolves.toEqual([]);

    const reopenedAutonomousSource = createDataSource({ kind: 'autonomous' });
    await expect(reopenedAutonomousSource.getProject(project.id)).resolves.toMatchObject({
      id: project.id,
    });
  });

  test('restores one scope from browser storage without exposing it to another scope', async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const autonomousSource = createPersistentBrowserDataSource(
      { kind: 'autonomous' },
      storage,
    );
    await autonomousSource.saveProject({ ...project, id: 'persisted-autonomous-project' });

    const reopenedAutonomousSource = createPersistentBrowserDataSource(
      { kind: 'autonomous' },
      storage,
    );
    const accountSource = createPersistentBrowserDataSource(
      { kind: 'account', accountId: 'account-b' },
      storage,
    );

    const reopenedProjects = await reopenedAutonomousSource.listProjects();
    expect(reopenedProjects).toHaveLength(1);
    expect(reopenedProjects[0]).toMatchObject({ title: project.title });
    expect(isUuid(reopenedProjects[0].id)).toBe(true);
    await expect(accountSource.getProject('persisted-autonomous-project')).resolves.toBeNull();
  });

  test('persists the last successful account synchronization time', async () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    const scope = { kind: 'account' as const, accountId: 'account-sync-status' };
    const source = createPersistentBrowserDataSource(scope, storage) as unknown as SyncStatusSource;

    await source.recordSyncSuccess('2026-09-04T10:00:00.000Z');

    const reopened = createPersistentBrowserDataSource(scope, storage) as unknown as SyncStatusSource;
    await expect(reopened.getLastSyncSuccessAt()).resolves.toBe('2026-09-04T10:00:00.000Z');
  });
});
