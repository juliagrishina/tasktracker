import type { DataScopeRegistry, LocalDataScope } from '../data/local-data-scopes';

export async function recoverOfflineAccountScope(
  scopeRegistry: Pick<DataScopeRegistry, 'getActiveScope'>,
): Promise<Extract<LocalDataScope, { kind: 'account' }> | null> {
  const scope = await scopeRegistry.getActiveScope();
  return scope.kind === 'account' ? scope : null;
}
