import { convertReminderToTask } from '../../src/application/convert-reminder-to-task';
import { createInMemoryDataSource } from '../../src/data/data-source.web';

const createdAt = '2026-08-02T09:00:00.000Z';

describe('convertReminderToTask', () => {
  test('replaces a stored reminder with a standalone task', async () => {
    const source = createInMemoryDataSource();
    await source.saveReminder({
      id: 'reminder-1',
      title: 'Позвонить в страховую',
      taskItemId: null,
      projectId: null,
      remindsAt: '2026-08-02T10:00:00.000Z',
      createdAt,
    });

    const task = await convertReminderToTask(source, {
      reminderId: 'reminder-1',
      taskId: 'task-2',
      createdAt,
    });

    expect(task).toMatchObject({
      id: 'task-2',
      kind: 'task',
      projectId: null,
      parentTaskId: null,
      title: 'Позвонить в страховую',
    });
    await expect(source.getReminder('reminder-1')).resolves.toBeNull();
    await expect(source.getTaskItem('task-2')).resolves.toEqual(task);
  });
});
