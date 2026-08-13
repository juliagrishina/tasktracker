import type {
  RecurrenceOccurrence,
  RecurrenceSeries,
  ScheduleBlock,
  TaskItem,
} from '../../src/domain/entities';
import { createInMemoryDataSource } from '../../src/data/data-source.web';

const createdAt = '2026-08-05T08:00:00.000Z';

const task: TaskItem = {
  id: 'task-planning-1',
  kind: 'task',
  projectId: null,
  parentTaskId: null,
  title: 'Prepare weekly plan',
  description: null,
  scheduledOn: null,
  periodStartOn: null,
  periodEndOn: null,
  estimatedDurationMinutes: null,
  completedAt: null,
  createdAt,
};

const block: ScheduleBlock = {
  id: 'block-planning-1',
  taskItemId: task.id,
  occurrenceId: null,
  startsAt: '2026-08-05T09:00:00.000Z',
  endsAt: '2026-08-05T09:30:00.000Z',
  createdAt,
};

const series: RecurrenceSeries = {
  id: 'series-planning-1',
  itemKind: 'task',
  itemId: task.id,
  frequency: 'weekly',
  interval: 1,
  startsOn: '2026-08-05',
  createdAt,
};

const occurrence: RecurrenceOccurrence = {
  id: 'occurrence-planning-1',
  seriesId: series.id,
  occursOn: '2026-08-12',
  status: 'cancelled',
  createdAt,
};

describe('planning data source', () => {
  test('lists planning records in creation order and supports deletion by id', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    await source.saveScheduleBlock(block);
    await source.saveRecurrenceSeries(series);
    await source.saveRecurrenceOccurrence(occurrence);

    await expect(source.listScheduleBlocksForTaskItem(task.id)).resolves.toEqual([block]);
    await expect(source.listRecurrenceSeries()).resolves.toEqual([series]);
    await expect(source.listRecurrenceOccurrences()).resolves.toEqual([occurrence]);

    await source.saveScheduleBlock({ ...block, occurrenceId: occurrence.id });
    await source.deleteRecurrenceOccurrence(occurrence.id);

    await expect(source.getScheduleBlock(block.id)).resolves.toEqual({
      ...block,
      occurrenceId: null,
    });

    await source.deleteScheduleBlock(block.id);
    await source.deleteRecurrenceSeries(series.id);

    await expect(source.listScheduleBlocks()).resolves.toEqual([]);
    await expect(source.listRecurrenceOccurrences()).resolves.toEqual([]);
    await expect(source.listRecurrenceSeries()).resolves.toEqual([]);
  });

  test('removes blocks, a series and its occurrence when its task is deleted', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    await source.saveScheduleBlock(block);
    await source.saveRecurrenceSeries(series);
    await source.saveRecurrenceOccurrence(occurrence);

    await source.deleteTaskItem(task.id);

    await expect(source.listScheduleBlocks()).resolves.toEqual([]);
    await expect(source.listRecurrenceSeries()).resolves.toEqual([]);
    await expect(source.listRecurrenceOccurrences()).resolves.toEqual([]);
  });
});
