import { runPersistenceDiagnostic } from '../../src/application/persistence-diagnostic';
import { createInMemoryDataSource } from '../../src/data/data-source.web';

describe('runPersistenceDiagnostic', () => {
  test('reports persisted when the diagnostic record already exists', async () => {
    const source = createInMemoryDataSource();
    await source.initialize();

    await expect(runPersistenceDiagnostic(source)).resolves.toBe('created');
    await expect(runPersistenceDiagnostic(source)).resolves.toBe('persisted');
  });
});
