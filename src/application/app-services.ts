import type { AppDataSource } from '../data/contracts';
import { ProjectRepository } from '../data/repositories/project-repository';
import { SettingsRepository } from '../data/repositories/settings-repository';

export interface AppRepositories {
  projects: ProjectRepository;
  settings: SettingsRepository;
}

export function createAppRepositories(source: AppDataSource): AppRepositories {
  return {
    projects: new ProjectRepository(source),
    settings: new SettingsRepository(source),
  };
}
