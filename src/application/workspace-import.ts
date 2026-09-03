import type { AppDataSource } from '../data/contracts';
import type { LocalDataScope } from '../data/local-data-scopes';
import type { TaskItem } from '../domain/entities';

export interface AutonomousWorkspaceImportInput {
  autonomous: AppDataSource;
  account: AppDataSource;
}

export interface WorkspaceTransferService {
  hasAutonomousData(): Promise<boolean>;
  importIntoAccount(accountId: string): Promise<void>;
}

export function createWorkspaceTransferService({
  sourceForScope,
}: {
  sourceForScope(scope: LocalDataScope): AppDataSource;
}): WorkspaceTransferService {
  const autonomousScope: LocalDataScope = { kind: 'autonomous' };

  return {
    hasAutonomousData: async () => {
      const source = sourceForScope(autonomousScope);
      await source.initialize();
      const collections = await Promise.all([
        source.listDailyEnergyEntries(),
        source.listProjects(),
        source.listTaskItems(),
        source.listReminders(),
        source.listScheduleBlocks(),
        source.listRecurrenceSeries(),
        source.listTransferHistories(),
      ]);
      return collections.some((items) => items.length > 0);
    },
    importIntoAccount: async (accountId) =>
      importAutonomousWorkspace({
        autonomous: sourceForScope(autonomousScope),
        account: sourceForScope({ kind: 'account', accountId }),
      }),
  };
}

/**
 * Copies the autonomous replica into an account replica. The autonomous source is
 * read-only for this operation and therefore remains available if the import is
 * interrupted or rejected. The account transaction also makes retrying safe.
 */
export async function importAutonomousWorkspace({
  autonomous,
  account,
}: AutonomousWorkspaceImportInput): Promise<void> {
  await Promise.all([autonomous.initialize(), account.initialize()]);

  const [
    settings,
    dailyEnergyEntries,
    projects,
    taskItems,
    reminders,
    recurrenceSeries,
    scheduleBlocks,
    transferHistories,
  ] = await Promise.all([
    autonomous.getSettings(),
    autonomous.listDailyEnergyEntries(),
    autonomous.listProjects(),
    autonomous.listTaskItems(),
    autonomous.listReminders(),
    autonomous.listRecurrenceSeries(),
    autonomous.listScheduleBlocks(),
    autonomous.listTransferHistories(),
  ]);
  const recurrenceRevisions = await Promise.all(
    recurrenceSeries.map((series) => autonomous.listRecurrenceRevisions(series.id)),
  );
  const recurrenceOccurrences = await Promise.all(
    recurrenceSeries.map((series) => autonomous.listRecurrenceOccurrences(series.id)),
  );

  await account.transaction(async () => {
    await account.saveSettings(settings);
    for (const entry of dailyEnergyEntries) await account.saveDailyEnergyEntry(entry);
    for (const project of projects) await account.saveProject(project);
    await saveTasks(account, taskItems);
    for (const reminder of reminders) await account.saveReminder(reminder);
    for (const series of recurrenceSeries) await account.saveRecurrenceSeries(series);
    for (const revision of recurrenceRevisions.flat()) await account.saveRecurrenceRevision(revision);
    for (const occurrence of recurrenceOccurrences.flat()) await account.saveRecurrenceOccurrence(occurrence);
    for (const block of scheduleBlocks) await account.saveScheduleBlock(block);
    for (const history of transferHistories) await account.saveTransferHistory(history);
  });
}

async function saveTasks(account: AppDataSource, taskItems: readonly TaskItem[]): Promise<void> {
  for (const task of taskItems.filter((item) => item.kind === 'task')) {
    await account.saveTaskItem(task);
  }
  for (const subtask of taskItems.filter((item) => item.kind === 'subtask')) {
    await account.saveTaskItem(subtask);
  }
}
