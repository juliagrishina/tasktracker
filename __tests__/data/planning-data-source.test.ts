import type {
  RecurrenceOccurrence,
  RecurrenceSeries,
  Reminder,
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
  timeZoneId: null,
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

const reminder: Reminder = {
  id: 'reminder-planning-1',
  title: 'Позвонить',
  remindsOn: '2026-08-05',
  periodStartOn: null,
  periodEndOn: null,
  repeatRule: null,
  estimatedDurationMinutes: 20,
  completedAt: null,
  createdAt,
};

const reminderSeries: RecurrenceSeries = {
  ...series,
  id: 'series-reminder-1',
  itemKind: 'reminder',
  itemId: reminder.id,
};

const occurrence: RecurrenceOccurrence = {
  id: 'occurrence-planning-1',
  seriesId: series.id,
  occursOn: '2026-08-12',
  status: 'cancelled',
  completedAt: null,
  blocksOverridden: false,
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

  test('rejects a second exception for the same recurrence date', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    await source.saveRecurrenceSeries(series);
    await source.saveRecurrenceOccurrence(occurrence);

    await expect(source.saveRecurrenceOccurrence({
      ...occurrence,
      id: 'occurrence-duplicate-date',
    })).rejects.toThrow('уже существует');
  });

  test('rejects a block that refers to an unknown recurrence occurrence', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);

    await expect(source.saveScheduleBlock({
      ...block,
      id: 'orphan-occurrence-block',
      occurrenceId: 'unknown-occurrence',
    })).rejects.toThrow();
  });

  test('round-trips completed reminder exception and a block time zone', async () => {
    const source = createInMemoryDataSource();
    const completedOccurrence: RecurrenceOccurrence = {
      id: 'occurrence-completed',
      seriesId: reminderSeries.id,
      occursOn: '2026-08-13',
      status: 'completed',
      completedAt: '2026-08-13T08:00:00.000Z',
      blocksOverridden: true,
      reminderPatch: {
        title: 'Позвонить',
        remindsOn: '2026-08-14',
        periodStartOn: null,
        periodEndOn: null,
        estimatedDurationMinutes: 20,
      },
      createdAt,
    };
    const zonedBlock = {
      ...block,
      id: 'block-with-zone',
      timeZoneId: 'Europe/Moscow',
    };

    await source.saveTaskItem(task);
    await source.saveReminder(reminder);
    await source.saveRecurrenceSeries(reminderSeries);
    await source.saveRecurrenceOccurrence(completedOccurrence);
    await source.saveScheduleBlock(zonedBlock);

    await expect(source.getRecurrenceOccurrence(completedOccurrence.id)).resolves.toMatchObject({
      status: 'completed',
      completedAt: '2026-08-13T08:00:00.000Z',
      reminderPatch: completedOccurrence.reminderPatch,
      blocksOverridden: true,
    });
    await expect(source.getScheduleBlock(zonedBlock.id)).resolves.toMatchObject({
      timeZoneId: 'Europe/Moscow',
    });
  });

  test('rejects a completed occurrence without its completion instant', async () => {
    const source = createInMemoryDataSource();
    await source.saveReminder(reminder);
    await source.saveRecurrenceSeries(reminderSeries);

    await expect(source.saveRecurrenceOccurrence({
      id: 'occurrence-invalid-completion',
      seriesId: reminderSeries.id,
      occursOn: '2026-08-13',
      status: 'completed',
      completedAt: null,
      blocksOverridden: false,
      createdAt,
    })).rejects.toThrow();
  });

  test('normalizes absent legacy nullable fields before returning browser records', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem(task);
    await source.saveRecurrenceSeries(series);

    await source.saveScheduleBlock({
      ...block,
      id: 'legacy-zone-block',
    } as unknown as ScheduleBlock);
    await source.saveRecurrenceOccurrence({
      ...occurrence,
      id: 'legacy-null-occurrence',
      occursOn: '2026-08-19',
      completedAt: undefined,
    } as unknown as RecurrenceOccurrence);

    await expect(source.getScheduleBlock('legacy-zone-block')).resolves.toMatchObject({
      timeZoneId: null,
    });
    await expect(source.getRecurrenceOccurrence('legacy-null-occurrence')).resolves.toMatchObject({
      completedAt: null,
      blocksOverridden: false,
    });
  });
});
