import type { Reminder } from '../../src/domain/entities';
import { createTaskFromReminder } from '../../src/domain/reminder-conversion';

const createdAt = '2026-08-02T09:00:00.000Z';

const reminder: Reminder = {
  id: 'reminder-1',
  title: 'Позвонить в страховую',
  remindsOn: '2026-08-02',
  periodStartOn: null,
  periodEndOn: null,
  repeatRule: null,
  estimatedDurationMinutes: 15,
  completedAt: null,
  createdAt,
};

describe('createTaskFromReminder', () => {
  test('creates a standalone task with the reminder title', () => {
    expect(createTaskFromReminder(reminder, 'task-2', createdAt)).toEqual({
      id: 'task-2',
      kind: 'task',
      projectId: null,
      parentTaskId: null,
      title: 'Позвонить в страховую',
      description: null,
      scheduledOn: reminder.remindsOn,
      periodStartOn: reminder.periodStartOn,
      periodEndOn: reminder.periodEndOn,
      estimatedDurationMinutes: 15,
      completedAt: null,
      createdAt,
    });
  });
});
