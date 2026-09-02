export type LocalDataScope =
  | { kind: 'autonomous' }
  | { kind: 'account'; accountId: string };

export interface DataScopeStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

interface PersistedDataScopeRegistry {
  activeScope: LocalDataScope;
  accountIds: string[];
}

const registryStorageKey = 'tasktracker.local-data-scopes.v1';
const accountIdPattern = /^[A-Za-z0-9_-]{1,128}$/;

export interface DataScopeRegistry {
  getActiveScope(): Promise<LocalDataScope>;
  openAutonomousScope(): Promise<void>;
  openAccountScope(accountId: string): Promise<void>;
  hideAccountScope(accountId: string): Promise<void>;
  listKnownAccountIds(): Promise<readonly string[]>;
}

export function createDataScopeRegistry(storage: DataScopeStorage): DataScopeRegistry {
  let state: PersistedDataScopeRegistry | null = null;
  let initialization: Promise<void> | null = null;

  const initialize = async (): Promise<void> => {
    if (initialization === null) {
      initialization = (async () => {
        const stored = await storage.getItem(registryStorageKey);
        state = parseRegistry(stored);
      })();
    }

    await initialization;
  };

  const current = (): PersistedDataScopeRegistry => {
    if (state === null) {
      throw new Error('Local data scope registry was not initialized.');
    }

    return state;
  };

  const save = async (): Promise<void> => {
    await storage.setItem(registryStorageKey, JSON.stringify(current()));
  };

  return {
    getActiveScope: async () => {
      await initialize();
      return current().activeScope;
    },
    openAutonomousScope: async () => {
      await initialize();
      current().activeScope = { kind: 'autonomous' };
      await save();
    },
    openAccountScope: async (accountId) => {
      assertAccountId(accountId);
      await initialize();
      const registry = current();
      if (!registry.accountIds.includes(accountId)) {
        registry.accountIds.push(accountId);
      }
      registry.activeScope = { kind: 'account', accountId };
      await save();
    },
    hideAccountScope: async (accountId) => {
      assertAccountId(accountId);
      await initialize();
      const registry = current();
      if (registry.activeScope.kind === 'account' && registry.activeScope.accountId === accountId) {
        registry.activeScope = { kind: 'autonomous' };
        await save();
      }
    },
    listKnownAccountIds: async () => {
      await initialize();
      return [...current().accountIds];
    },
  };
}

export function databaseNameForScope(scope: LocalDataScope): string {
  if (scope.kind === 'autonomous') {
    return 'tasktracker-autonomous.db';
  }

  assertAccountId(scope.accountId);
  return `tasktracker-account-${scope.accountId}.db`;
}

function parseRegistry(value: string | null): PersistedDataScopeRegistry {
  if (value === null) {
    return { activeScope: { kind: 'autonomous' }, accountIds: [] };
  }

  try {
    const parsed = JSON.parse(value) as Partial<PersistedDataScopeRegistry>;
    const accountIds = Array.isArray(parsed.accountIds)
      ? parsed.accountIds.filter((accountId): accountId is string =>
        typeof accountId === 'string' && accountIdPattern.test(accountId),
      )
      : [];
    const activeScope = isValidScope(parsed.activeScope, accountIds)
      ? parsed.activeScope
      : { kind: 'autonomous' as const };
    return { activeScope, accountIds };
  } catch {
    return { activeScope: { kind: 'autonomous' }, accountIds: [] };
  }
}

function isValidScope(
  scope: Partial<LocalDataScope> | undefined,
  accountIds: readonly string[],
): scope is LocalDataScope {
  return scope?.kind === 'autonomous'
    || (scope?.kind === 'account'
      && typeof scope.accountId === 'string'
      && accountIds.includes(scope.accountId));
}

function assertAccountId(accountId: string): void {
  if (!accountIdPattern.test(accountId)) {
    throw new Error('Account id contains unsupported characters for a local data scope.');
  }
}
