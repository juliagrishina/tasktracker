import type { AppDataSource } from '../data/contracts';
import type { EntityId, RecurrenceOccurrence, ScheduleBlock } from '../domain/entities';
import { getDateInTimeZone, getRecurrenceDates } from '../domain/planning';

import { getPlanScheduleBlocks } from './planning-use-cases';

export interface CompletionEligibility {
  taskItemId: EntityId;
  occurrence: { occursOn: string; seriesId: EntityId } | null;
}

interface Candidate extends CompletionEligibility {
  endsAt: string;
}

function hasEnded(block: ScheduleBlock, now: Date): boolean {
  return new Date(block.endsAt).getTime() <= now.getTime();
}

function latestBlock(blocks: readonly ScheduleBlock[]): ScheduleBlock | null {
  return blocks.reduce<ScheduleBlock | null>((latest, block) => latest === null || new Date(block.endsAt).getTime() > new Date(latest.endsAt).getTime() ? block : latest, null);
}

function parseVirtualOccurrence(id: string | null): { occursOn: string; seriesId: EntityId } | null {
  if (id === null) return null;
  const parts = id.split(':');
  return parts[0] === 'virtual' && parts[1] !== undefined && parts[2] !== undefined
    ? { seriesId: parts[1], occursOn: parts[2] }
    : null;
}

function createOccurrenceMap(occurrences: readonly RecurrenceOccurrence[]): ReadonlyMap<EntityId, RecurrenceOccurrence> {
  return new Map(occurrences.map((occurrence) => [occurrence.id, occurrence]));
}

export async function getCompletionEligibility(source: AppDataSource, now = new Date()): Promise<readonly CompletionEligibility[]> {
  const [settings, allBlocks, tasks, series] = await Promise.all([
    source.getSettings(),
    source.listScheduleBlocks(),
    source.listTaskItems(),
    source.listRecurrenceSeries(),
  ]);
  const activeTasks = new Map(tasks.filter((task) => task.completedAt === null).map((task) => [task.id, task]));
  const seriesByTaskId = new Map(series.filter((candidate) => candidate.itemKind === 'task').map((candidate) => [candidate.itemId, candidate]));
  const currentDate = getDateInTimeZone(now.toISOString(), settings.timeZoneId);
  const recurrenceDates = new Set(
    series
      .filter((candidate) => candidate.itemKind === 'task' && candidate.startsOn <= currentDate)
      .flatMap((candidate) => getRecurrenceDates(candidate, candidate.startsOn, currentDate)),
  );
  const recurrenceBlocks = (await Promise.all([...recurrenceDates].map((date) => getPlanScheduleBlocks(source, date)))).flat();
  const recurrenceOccurrences = createOccurrenceMap((await Promise.all(series.map((candidate) => source.listRecurrenceOccurrences(candidate.id)))).flat());
  const candidates: Candidate[] = [];

  for (const task of activeTasks.values()) {
    const recurrence = seriesByTaskId.get(task.id);
    if (recurrence === undefined) {
      const last = latestBlock(allBlocks.filter((block) => block.taskItemId === task.id));
      if (last !== null && hasEnded(last, now)) candidates.push({ taskItemId: task.id, occurrence: null, endsAt: last.endsAt });
      continue;
    }

    const occurrenceBlocks = new Map<string, { blocks: ScheduleBlock[]; occurrence: { occursOn: string; seriesId: EntityId } }>();
    for (const block of recurrenceBlocks.filter((candidate) => candidate.taskItemId === task.id)) {
      const virtual = parseVirtualOccurrence(block.occurrenceId);
      const stored = block.occurrenceId === null ? null : recurrenceOccurrences.get(block.occurrenceId);
      const occurrence = virtual ?? (stored === undefined || stored === null ? null : { seriesId: stored.seriesId, occursOn: stored.occursOn });
      if (occurrence === null || occurrence.seriesId !== recurrence.id || stored?.completedAt !== null && stored?.completedAt !== undefined || stored?.cancelledAt !== null && stored?.cancelledAt !== undefined) continue;
      const key = `${occurrence.seriesId}:${occurrence.occursOn}`;
      const current = occurrenceBlocks.get(key) ?? { blocks: [], occurrence };
      current.blocks.push(block);
      occurrenceBlocks.set(key, current);
    }
    const eligibleOccurrences: Candidate[] = [];
    for (const group of occurrenceBlocks.values()) {
      const last = latestBlock(group.blocks);
      if (last !== null && hasEnded(last, now)) eligibleOccurrences.push({ taskItemId: task.id, occurrence: group.occurrence, endsAt: last.endsAt });
    }
    const latestOccurrence = eligibleOccurrences.reduce<Candidate | null>((latest, candidate) => latest === null || candidate.endsAt > latest.endsAt ? candidate : latest, null);
    if (latestOccurrence !== null) candidates.push(latestOccurrence);
  }

  return candidates
    .sort((left, right) => left.endsAt.localeCompare(right.endsAt) || left.taskItemId.localeCompare(right.taskItemId))
    .map(({ endsAt: _endsAt, ...candidate }) => candidate);
}
