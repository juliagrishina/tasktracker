import { getEveningReviewItems, synchronizeEveningReviewNotification } from '../../src/application/evening-review';
import { getDefaultSettings } from '../../src/data/default-settings';
import { createInMemoryDataSource } from '../../src/data/data-source.web';

const createdAt = '2026-08-01T00:00:00.000Z';

describe('evening review', () => {
  test('lists only incomplete tasks and reminders for the selected day without changing them', async () => {
    const source = createInMemoryDataSource();
    await source.saveTaskItem({ id: 'active-date-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Подготовить отчёт', description: null, estimatedDurationMinutes: null, scheduledOn: '2026-08-28', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveTaskItem({ id: 'completed-date-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Готовая задача', description: null, estimatedDurationMinutes: null, scheduledOn: '2026-08-28', periodStartOn: null, periodEndOn: null, completedAt: createdAt, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveTaskItem({ id: 'active-timed-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Созвон с командой', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveScheduleBlock({ id: 'active-block', taskItemId: 'active-timed-task', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-28T09:00:00+03:00', endsAt: '2026-08-28T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveReminder({ id: 'active-reminder', title: 'Проверить письмо', remindsOn: '2026-08-28', periodStartOn: null, periodEndOn: null, repeatRule: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await source.saveReminder({ id: 'completed-reminder', title: 'Готовое напоминание', remindsOn: '2026-08-28', periodStartOn: null, periodEndOn: null, repeatRule: null, estimatedDurationMinutes: null, completedAt: createdAt, createdAt, updatedAt: createdAt, deletedAt: null });

    await expect(getEveningReviewItems(source, '2026-08-28')).resolves.toEqual([
      { id: 'active-timed-task', kind: 'task', title: 'Созвон с командой', occurrence: null },
      { id: 'active-date-task', kind: 'task', title: 'Подготовить отчёт', occurrence: null },
      { id: 'active-reminder', kind: 'reminder', title: 'Проверить письмо', occurrence: null },
    ]);
    await expect(source.getTaskItem('active-date-task')).resolves.toMatchObject({ completedAt: null, scheduledOn: '2026-08-28' });
    await expect(source.getReminder('active-reminder')).resolves.toMatchObject({ completedAt: null, remindsOn: '2026-08-28' });
  });

  test('schedules one future review notification and stores its identifier', async () => {
    const source = createInMemoryDataSource();
    const scheduler = { cancel: jest.fn(), schedule: jest.fn().mockResolvedValue('evening-notification-1') };
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow', timeZoneMode: 'manual' });
    await source.saveTaskItem({ id: 'review-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Подготовить отчёт', description: null, estimatedDurationMinutes: null, scheduledOn: '2026-08-28', periodStartOn: null, periodEndOn: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });

    await synchronizeEveningReviewNotification({ source, scheduler, now: new Date('2026-08-28T17:00:00.000Z') });

    expect(scheduler.schedule).toHaveBeenCalledWith({ title: 'Вечерняя проверка', body: 'Незавершённых дел: 1', scheduledAt: '2026-08-28T18:00:00.000Z' });
    await expect(source.getSettings()).resolves.toMatchObject({ eveningReviewNotificationId: 'evening-notification-1' });
  });

  test('removes a prior notification after the review time without scheduling a replacement', async () => {
    const source = createInMemoryDataSource();
    const scheduler = { cancel: jest.fn(), schedule: jest.fn() };
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow', timeZoneMode: 'manual', eveningReviewNotificationId: 'old-review-notification' });

    await synchronizeEveningReviewNotification({ source, scheduler, now: new Date('2026-08-28T18:30:00.000Z') });

    expect(scheduler.cancel).toHaveBeenCalledWith('old-review-notification');
    expect(scheduler.schedule).not.toHaveBeenCalled();
    await expect(source.getSettings()).resolves.toMatchObject({ eveningReviewNotificationId: null });
  });
});
