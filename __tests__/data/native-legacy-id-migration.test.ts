import { migrateLegacyIdsInNativeDatabase } from '../../src/data/native-legacy-id-migration';
import { stableLegacyUuid } from '../../src/domain/uuid';

describe('native legacy identifier migration', () => {
  test('removes a legacy row when its deterministic UUID copy is already present', async () => {
    const legacyProjectId = 'demo-project-personal';
    const migratedProjectId = stableLegacyUuid('projects', legacyProjectId);
    const database = {
      getAllAsync: jest.fn(async (query: string) => {
        if (query === 'SELECT id FROM projects') {
          return [{ id: legacyProjectId }, { id: migratedProjectId }];
        }
        return [];
      }),
      getFirstAsync: jest.fn(async (query: string) => {
        if (query === 'SELECT id FROM projects WHERE id = ?') {
          return { id: migratedProjectId };
        }
        return null;
      }),
      runAsync: jest.fn().mockResolvedValue(undefined),
      execAsync: jest.fn().mockResolvedValue(undefined),
      withTransactionAsync: jest.fn(async (operation: () => Promise<void>) => operation()),
    };

    await migrateLegacyIdsInNativeDatabase(database as never);

    expect(database.runAsync).toHaveBeenCalledWith(
      'DELETE FROM projects WHERE id = ?',
      [legacyProjectId],
    );
  });
});
