import type { AppDataSource } from '../contracts';
import type { EntityId, Project } from '../../domain/entities';

export class ProjectRepository {
  constructor(private readonly source: AppDataSource) {}

  save(project: Project): Promise<void> {
    return this.source.saveProject(project);
  }

  findById(id: EntityId): Promise<Project | null> {
    return this.source.getProject(id);
  }
}
