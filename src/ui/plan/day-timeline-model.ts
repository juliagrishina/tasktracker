import type { ScheduleBlock } from '../../domain/entities';
import { getDateTimeInTimeZone } from '../../domain/planning';

export interface DayTimelineBlockLayout {
  block: ScheduleBlock;
  blockId: string;
  column: number;
  columnCount: number;
  durationMinutes: number;
  startMinute: number;
}

interface PositionedBlock {
  block: ScheduleBlock;
  durationMinutes: number;
  startMinute: number;
}

function toMinute(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function minuteWithinDay(instant: string, selectedDate: string, timeZoneId: string, isEnd: boolean): number {
  const dateTime = getDateTimeInTimeZone(instant, timeZoneId);
  if (dateTime.date < selectedDate) return 0;
  if (dateTime.date > selectedDate) return 24 * 60;
  const minute = toMinute(dateTime.time);
  return isEnd && minute === 0 && new Date(instant).getTime() > new Date(`${selectedDate}T00:00:00Z`).getTime() ? 24 * 60 : minute;
}

function positionBlocks(blocks: readonly ScheduleBlock[], selectedDate: string, timeZoneId: string): PositionedBlock[] {
  return blocks.map((block) => {
    const startMinute = minuteWithinDay(block.startsAt, selectedDate, timeZoneId, false);
    const endMinute = minuteWithinDay(block.endsAt, selectedDate, timeZoneId, true);
    return { block, startMinute, durationMinutes: Math.max(0, endMinute - startMinute) };
  }).filter((block) => block.durationMinutes > 0).sort((left, right) => left.startMinute - right.startMinute || left.durationMinutes - right.durationMinutes || left.block.id.localeCompare(right.block.id));
}

function layoutOverlapGroup(group: readonly PositionedBlock[]): DayTimelineBlockLayout[] {
  const columnEnds: number[] = [];
  const layouts = group.map((item) => {
    const column = columnEnds.findIndex((endMinute) => endMinute <= item.startMinute);
    const resolvedColumn = column === -1 ? columnEnds.length : column;
    columnEnds[resolvedColumn] = item.startMinute + item.durationMinutes;
    return {
      block: item.block,
      blockId: item.block.id,
      column: resolvedColumn,
      columnCount: 0,
      durationMinutes: item.durationMinutes,
      startMinute: item.startMinute,
    };
  });
  return layouts.map((layout) => ({ ...layout, columnCount: columnEnds.length }));
}

export function getDayTimelineBlockLayouts(blocks: readonly ScheduleBlock[], selectedDate: string, timeZoneId: string): DayTimelineBlockLayout[] {
  const positioned = positionBlocks(blocks, selectedDate, timeZoneId);
  const layouts: DayTimelineBlockLayout[] = [];
  let group: PositionedBlock[] = [];
  let groupEndMinute = 0;

  for (const block of positioned) {
    if (group.length !== 0 && block.startMinute >= groupEndMinute) {
      layouts.push(...layoutOverlapGroup(group));
      group = [];
      groupEndMinute = 0;
    }
    group.push(block);
    groupEndMinute = Math.max(groupEndMinute, block.startMinute + block.durationMinutes);
  }
  if (group.length !== 0) layouts.push(...layoutOverlapGroup(group));
  return layouts;
}
