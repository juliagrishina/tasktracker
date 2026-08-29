import type { AppDataSource } from '../data/contracts';
import type { DailyEnergyEntry } from '../domain/entities';
import { getDateInTimeZone } from '../domain/planning';

export interface SaveDailyEnergyInput {
  energyPercent: number | null;
  now?: Date;
}

function assertEnergyPercent(energyPercent: number | null): void {
  if (energyPercent === null) return;
  if (!Number.isInteger(energyPercent) || energyPercent < 0 || energyPercent > 100 || energyPercent % 5 !== 0) {
    throw new Error('Оценка энергии должна быть целым числом от 0 до 100 с шагом 5');
  }
}

export async function getDailyEnergyForCurrentDay(
  source: AppDataSource,
  now = new Date(),
): Promise<DailyEnergyEntry | null> {
  const settings = await source.getSettings();
  return source.getDailyEnergyEntry(getDateInTimeZone(now.toISOString(), settings.timeZoneId));
}

export async function saveDailyEnergyForCurrentDay(
  source: AppDataSource,
  input: SaveDailyEnergyInput,
): Promise<DailyEnergyEntry> {
  assertEnergyPercent(input.energyPercent);
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const settings = await source.getSettings();
  const recordedOn = getDateInTimeZone(timestamp, settings.timeZoneId);
  const existing = await source.getDailyEnergyEntry(recordedOn);
  const entry: DailyEnergyEntry = {
    recordedOn,
    energyPercent: input.energyPercent,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  await source.saveDailyEnergyEntry(entry);
  return entry;
}
