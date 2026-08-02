import type { AppSettings } from '../../domain/entities';
import type { AppDataSource } from '../contracts';

export class SettingsRepository {
  constructor(private readonly source: AppDataSource) {}

  get(): Promise<AppSettings> {
    return this.source.getSettings();
  }
}
