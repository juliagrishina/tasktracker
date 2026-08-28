import { synchronizeScheduleBlockNotification } from '../../src/application/notification-scheduling';

describe('schedule block notifications', () => {
  test('schedules one reminder at the configured lead time for a future block', async () => {
    const scheduler = { schedule: jest.fn().mockResolvedValue('notification-1'), cancel: jest.fn() };
    const block = {
      id: 'block-1', taskItemId: 'task-1', occurrenceId: null, notificationId: null,
      timeZoneId: 'Europe/Moscow', startsAt: '2026-09-01T10:00:00+03:00', endsAt: '2026-09-01T11:00:00+03:00',
      createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z', deletedAt: null,
    };

    const updated = await synchronizeScheduleBlockNotification({
      block,
      notificationLeadMinutes: 10,
      scheduler,
      taskTitle: 'Подготовить отчёт',
      now: new Date('2026-09-01T06:00:00.000Z'),
    });

    expect(scheduler.schedule).toHaveBeenCalledWith({ body: 'Подготовить отчёт начнётся в 10:00', scheduledAt: '2026-09-01T06:50:00.000Z', title: 'Скоро начнётся дело' });
    expect(updated.notificationId).toBe('notification-1');
  });

  test('cancels the previous reminder before rescheduling a changed block', async () => {
    const scheduler = { schedule: jest.fn().mockResolvedValue('notification-2'), cancel: jest.fn() };
    const block = {
      id: 'block-1', taskItemId: 'task-1', occurrenceId: null, notificationId: 'notification-1',
      timeZoneId: 'Europe/Moscow', startsAt: '2026-09-01T11:00:00+03:00', endsAt: '2026-09-01T12:00:00+03:00',
      createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z', deletedAt: null,
    };

    const updated = await synchronizeScheduleBlockNotification({
      block,
      notificationLeadMinutes: 10,
      scheduler,
      taskTitle: 'Подготовить отчёт',
      now: new Date('2026-09-01T06:00:00.000Z'),
    });

    expect(scheduler.cancel).toHaveBeenCalledWith('notification-1');
    expect(scheduler.schedule).toHaveBeenCalledWith(expect.objectContaining({ scheduledAt: '2026-09-01T07:50:00.000Z' }));
    expect(updated.notificationId).toBe('notification-2');
  });

  test('clears an expired reminder without scheduling another one', async () => {
    const scheduler = { schedule: jest.fn(), cancel: jest.fn() };
    const updated = await synchronizeScheduleBlockNotification({
      block: {
        id: 'block-1', taskItemId: 'task-1', occurrenceId: null, notificationId: 'notification-1',
        timeZoneId: 'Europe/Moscow', startsAt: '2026-09-01T10:00:00+03:00', endsAt: '2026-09-01T11:00:00+03:00',
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z', deletedAt: null,
      },
      notificationLeadMinutes: 10,
      scheduler,
      taskTitle: 'Подготовить отчёт',
      now: new Date('2026-09-01T06:50:00.000Z'),
    });

    expect(scheduler.cancel).toHaveBeenCalledWith('notification-1');
    expect(scheduler.schedule).not.toHaveBeenCalled();
    expect(updated.notificationId).toBeNull();
  });
});
