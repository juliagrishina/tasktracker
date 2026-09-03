import type { AppDataSource } from '../data/contracts';
import type { LocalDataScope } from '../data/local-data-scopes';

export async function clearAutonomousWorkspace({ scope, source }: { scope: LocalDataScope; source: AppDataSource }): Promise<void> {
  if (scope.kind !== 'autonomous') throw new Error('Only the autonomous workspace can be cleared by this action.');
  await source.clearAll();
}
