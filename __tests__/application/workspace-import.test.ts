import { createWorkspaceTransferService, importAutonomousWorkspace } from '../../src/application/workspace-import';
import { createInMemoryDataSource } from '../../src/data/data-source.web';

const createdAt = '2026-09-03T08:00:00.000Z';

describe('importAutonomousWorkspace', () => {
  test('copies autonomous data into an account replica without changing source UUIDs or relations', async () => {
    const autonomous = createInMemoryDataSource();
    const account = createInMemoryDataSource();
    await autonomous.saveProject({
      id: 'project-17',
      title: 'Переезд',
      description: null,
      completedAt: null,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    });
    await autonomous.saveTaskItem({
      id: 'task-17',
      kind: 'task',
      projectId: 'project-17',
      parentTaskId: null,
      title: 'Собрать документы',
      description: null,
      estimatedDurationMinutes: 60,
      completedAt: null,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    });
    await autonomous.saveScheduleBlock({
      id: 'block-17',
      taskItemId: 'task-17',
      occurrenceId: null,
      timeZoneId: 'Europe/Moscow',
      startsAt: '2026-09-04T07:00:00.000Z',
      endsAt: '2026-09-04T08:00:00.000Z',
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    });

    await importAutonomousWorkspace({ autonomous, account });

    await expect(account.getProject('project-17')).resolves.toMatchObject({ id: 'project-17' });
    await expect(account.getTaskItem('task-17')).resolves.toMatchObject({
      id: 'task-17',
      projectId: 'project-17',
    });
    await expect(account.getScheduleBlock('block-17')).resolves.toMatchObject({
      id: 'block-17',
      taskItemId: 'task-17',
    });
    await expect(autonomous.getTaskItem('task-17')).resolves.toMatchObject({
      id: 'task-17',
      projectId: 'project-17',
    });
  });

  test('keeps the autonomous source and rolls back the account replica when import is interrupted', async () => {
    const autonomous = createInMemoryDataSource();
    const account = createInMemoryDataSource();
    await autonomous.saveTaskItem({
      id: 'task-17',
      kind: 'task',
      projectId: null,
      parentTaskId: null,
      title: 'Собрать документы',
      description: null,
      estimatedDurationMinutes: null,
      completedAt: null,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    });
    await autonomous.saveScheduleBlock({
      id: 'block-17',
      taskItemId: 'task-17',
      occurrenceId: null,
      timeZoneId: 'Europe/Moscow',
      startsAt: '2026-09-04T07:00:00.000Z',
      endsAt: '2026-09-04T08:00:00.000Z',
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    });
    const interruptedAccount = {
      ...bindDataSource(account),
      saveScheduleBlock: async () => {
        throw new Error('Interrupted');
      },
    };

    await expect(importAutonomousWorkspace({ autonomous, account: interruptedAccount })).rejects.toThrow('Interrupted');

    await expect(account.getTaskItem('task-17')).resolves.toBeNull();
    await expect(autonomous.getTaskItem('task-17')).resolves.toMatchObject({ id: 'task-17' });
  });

  test('copies a saved daily energy mark', async () => {
    const autonomous = createInMemoryDataSource();
    const account = createInMemoryDataSource();
    await autonomous.saveDailyEnergyEntry({
      recordedOn: '2026-09-03',
      energyPercent: 75,
      createdAt,
      updatedAt: createdAt,
    });

    await importAutonomousWorkspace({ autonomous, account });

    await expect(account.getDailyEnergyEntry('2026-09-03')).resolves.toMatchObject({ energyPercent: 75 });
  });

  test('does not offer an import choice for an untouched autonomous area', async () => {
    const autonomous = createInMemoryDataSource();
    const account = createInMemoryDataSource();
    const transfer = createWorkspaceTransferService({
      sourceForScope: (scope) => scope.kind === 'autonomous' ? autonomous : account,
    });

    await expect(transfer.hasAutonomousData()).resolves.toBe(false);
  });

  test('retries a previously interrupted import without duplicating the autonomous workspace', async () => {
    const autonomous = createInMemoryDataSource();
    const account = createInMemoryDataSource();
    await autonomous.saveTaskItem({
      id: 'task-17',
      kind: 'task',
      projectId: null,
      parentTaskId: null,
      title: 'Собрать документы',
      description: null,
      estimatedDurationMinutes: null,
      completedAt: null,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    });
    const transfer = createWorkspaceTransferService({
      sourceForScope: (scope) => scope.kind === 'autonomous' ? autonomous : account,
    });

    await transfer.importIntoAccount('account-17');
    await transfer.importIntoAccount('account-17');

    await expect(account.listTaskItems()).resolves.toHaveLength(1);
    await expect(autonomous.listTaskItems()).resolves.toHaveLength(1);
  });
});

function bindDataSource(source: ReturnType<typeof createInMemoryDataSource>) {
  return {
    initialize: source.initialize.bind(source),
    getSettings: source.getSettings.bind(source),
    saveSettings: source.saveSettings.bind(source),
    getDailyEnergyEntry: source.getDailyEnergyEntry.bind(source),
    listDailyEnergyEntries: source.listDailyEnergyEntries.bind(source),
    saveDailyEnergyEntry: source.saveDailyEnergyEntry.bind(source),
    saveProject: source.saveProject.bind(source),
    getProject: source.getProject.bind(source),
    listProjects: source.listProjects.bind(source),
    deleteProject: source.deleteProject.bind(source),
    saveTaskItem: source.saveTaskItem.bind(source),
    getTaskItem: source.getTaskItem.bind(source),
    listTaskItems: source.listTaskItems.bind(source),
    deleteTaskItem: source.deleteTaskItem.bind(source),
    saveTransferHistory: source.saveTransferHistory.bind(source),
    listTransferHistories: source.listTransferHistories.bind(source),
    saveReminder: source.saveReminder.bind(source),
    getReminder: source.getReminder.bind(source),
    listReminders: source.listReminders.bind(source),
    deleteReminder: source.deleteReminder.bind(source),
    saveScheduleBlock: source.saveScheduleBlock.bind(source),
    getScheduleBlock: source.getScheduleBlock.bind(source),
    listScheduleBlocks: source.listScheduleBlocks.bind(source),
    listScheduleBlocksForTaskItem: source.listScheduleBlocksForTaskItem.bind(source),
    deleteScheduleBlock: source.deleteScheduleBlock.bind(source),
    saveRecurrenceSeries: source.saveRecurrenceSeries.bind(source),
    getRecurrenceSeries: source.getRecurrenceSeries.bind(source),
    listRecurrenceSeries: source.listRecurrenceSeries.bind(source),
    deleteRecurrenceSeries: source.deleteRecurrenceSeries.bind(source),
    saveRecurrenceRevision: source.saveRecurrenceRevision.bind(source),
    listRecurrenceRevisions: source.listRecurrenceRevisions.bind(source),
    deleteRecurrenceRevision: source.deleteRecurrenceRevision.bind(source),
    saveRecurrenceOccurrence: source.saveRecurrenceOccurrence.bind(source),
    getRecurrenceOccurrence: source.getRecurrenceOccurrence.bind(source),
    listRecurrenceOccurrences: source.listRecurrenceOccurrences.bind(source),
    deleteRecurrenceOccurrence: source.deleteRecurrenceOccurrence.bind(source),
    transaction: source.transaction.bind(source),
  };
}
