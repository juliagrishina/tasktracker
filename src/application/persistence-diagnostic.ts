import type { AppDataSource } from '../data/contracts';

const diagnosticProjectId = 'development-storage-diagnostic';
const diagnosticTaskId = 'development-storage-diagnostic-task';

export async function runPersistenceDiagnostic(
  source: AppDataSource,
): Promise<'created' | 'persisted'> {
  await source.initialize();

  const existingProject = await source.getProject(diagnosticProjectId);
  if (existingProject !== null) {
    return 'persisted';
  }

  const createdAt = new Date().toISOString();
  await source.saveProject({
    id: diagnosticProjectId,
    title: 'Проверка локального хранения',
    description: null,
    completedAt: null,
    createdAt,
  });
  await source.saveTaskItem({
    id: diagnosticTaskId,
    kind: 'task',
    projectId: diagnosticProjectId,
    parentTaskId: null,
    title: 'Тестовая запись хранения',
    description: null,
    scheduledOn: null,
    periodStartOn: null,
    periodEndOn: null,
    estimatedDurationMinutes: null,
    completedAt: null,
    createdAt,
  });

  return 'created';
}
