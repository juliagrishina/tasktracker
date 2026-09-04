import { createInMemoryDataSource } from '../../src/data/data-source.web';

describe('local sync outbox', () => {
  test('commits an account entity and its outbox mutation together', async () => {
    const source = createInMemoryDataSource({ kind: 'account', accountId: 'account-a' });

    await source.saveProject({
      id: 'project-a',
      title: 'Проект',
      description: null,
      completedAt: null,
      createdAt: '2026-09-04T10:00:00.000Z',
      updatedAt: '2026-09-04T10:00:00.000Z',
      deletedAt: null,
    });

    const [mutation] = await source.listSyncOutbox();
    expect(mutation).toMatchObject({
      entityType: 'projects',
      entityId: 'project-a',
      operation: 'upsert',
      expectedVersion: 0,
      dataGeneration: 1,
    });
    expect(mutation.deviceId).not.toHaveLength(0);
  });

  test('rolls back entity and outbox records as one transaction', async () => {
    const source = createInMemoryDataSource({ kind: 'account', accountId: 'account-a' });

    await expect(source.transaction(async () => {
      await source.saveProject({
        id: 'project-a', title: 'Проект', description: null, completedAt: null,
        createdAt: '2026-09-04T10:00:00.000Z', updatedAt: '2026-09-04T10:00:00.000Z', deletedAt: null,
      });
      throw new Error('rollback');
    })).rejects.toThrow('rollback');

    expect(await source.getProject('project-a')).toBeNull();
    expect(await source.listSyncOutbox()).toHaveLength(0);
  });

  test('records every affected entity after a cascading deletion', async () => {
    const source = createInMemoryDataSource({ kind: 'account', accountId: 'account-a' });
    const timestamp = '2026-09-04T10:00:00.000Z';
    await source.saveProject({ id: 'project-a', title: 'Проект', description: null, completedAt: null, createdAt: timestamp, updatedAt: timestamp, deletedAt: null });
    await source.saveTaskItem({ id: 'task-a', kind: 'task', projectId: 'project-a', parentTaskId: null, title: 'Задача', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt: timestamp, updatedAt: timestamp, deletedAt: null });
    await source.saveScheduleBlock({ id: 'block-a', taskItemId: 'task-a', occurrenceId: null, timeZoneId: 'UTC', startsAt: timestamp, endsAt: '2026-09-04T11:00:00.000Z', createdAt: timestamp, updatedAt: timestamp, deletedAt: null });

    await source.deleteProject('project-a');

    const mutations = await source.listSyncOutbox();
    expect(mutations).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: 'projects', operation: 'delete' }),
      expect.objectContaining({ entityType: 'task_items', operation: 'upsert', payload: expect.objectContaining({ projectId: null }) }),
    ]));
  });

  test('keeps autonomous changes offline without creating an outbox record', async () => {
    const source = createInMemoryDataSource();
    await source.saveProject({
      id: 'project-a', title: 'Автономный проект', description: null, completedAt: null,
      createdAt: '2026-09-04T10:00:00.000Z', updatedAt: '2026-09-04T10:00:00.000Z', deletedAt: null,
    });

    await expect(source.getProject('project-a')).resolves.toMatchObject({ title: 'Автономный проект' });
    await expect(source.listSyncOutbox()).resolves.toEqual([]);
  });

  test('discards an old local outbox when the account starts a new data generation', async () => {
    const source = createInMemoryDataSource({ kind: 'account', accountId: 'account-a' }) as unknown as {
      getLocalDataGeneration(): Promise<number>;
      getProject(id: string): Promise<unknown>;
      listSyncOutbox(): Promise<readonly unknown[]>;
      resetForFullResync(dataGeneration: number): Promise<void>;
      saveProject(project: { id: string; title: string; description: null; completedAt: null; createdAt: string; updatedAt: string; deletedAt: null }): Promise<void>;
    };
    await source.saveProject({ id: 'project-a', title: 'Очистить', description: null, completedAt: null, createdAt: '2026-09-04T10:00:00.000Z', updatedAt: '2026-09-04T10:00:00.000Z', deletedAt: null });

    await source.resetForFullResync(2);

    await expect(source.getProject('project-a')).resolves.toBeNull();
    await expect(source.listSyncOutbox()).resolves.toEqual([]);
    await expect(source.getLocalDataGeneration()).resolves.toBe(2);
  });

  test('removes the account replica and pending sync mutations when it is deleted', async () => {
    const source = createInMemoryDataSource({ kind: 'account', accountId: 'account-a' });
    await source.saveProject({
      id: 'project-a', title: 'Удаляемый проект', description: null, completedAt: null,
      createdAt: '2026-09-04T10:00:00.000Z', updatedAt: '2026-09-04T10:00:00.000Z', deletedAt: null,
    });

    await source.clearAll();

    await expect(source.getProject('project-a')).resolves.toBeNull();
    await expect(source.listSyncOutbox()).resolves.toEqual([]);
  });

  test('keeps a no-time calendar date unchanged when a remote entity is applied on another timezone', async () => {
    const source = createInMemoryDataSource({ kind: 'account', accountId: 'account-a' }) as unknown as {
      applyRemoteSyncChanges(changes: readonly unknown[], cursor: number): Promise<void>;
      getTaskItem(id: string): Promise<{ scheduledOn: string | null } | null>;
    };
    await source.applyRemoteSyncChanges([{
      changeCursor: 1, entityType: 'task_items', entityId: 'task-a', operation: 'upsert', version: 1,
      payload: { id: 'task-a', kind: 'task', projectId: null, parentTaskId: null, title: 'Без времени', description: null, estimatedDurationMinutes: null, scheduledOn: '2026-09-01', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', deletedAt: null },
    }], 1);

    await expect(source.getTaskItem('task-a')).resolves.toMatchObject({ scheduledOn: '2026-09-01' });
  });
});
