import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppServicesProvider } from '../../src/application/app-services-provider';
import type { LocalNotificationScheduler } from '../../src/application/notification-scheduling';
import { saveTaskPlanning } from '../../src/application/planning-use-cases';
import { getDefaultSettings } from '../../src/data/default-settings';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { DayDashboard } from '../../src/ui/plan/day-dashboard';

async function createMoscowDataSource() {
  const source = createInMemoryDataSource();
  await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Moscow', timeZoneMode: 'manual' });
  return source;
}

describe('recurrence move', () => {
  test('asks whether to move only the selected instance or the full series', async () => {
    const source = await createMoscowDataSource();
    const notificationScheduler: LocalNotificationScheduler = {
      schedule: async () => 'notification-1',
      cancel: async () => undefined,
    };
    const createdAt = '2026-08-01T00:00:00.000Z';
    await source.saveTaskItem({ id: 'task-1', kind: 'task', projectId: null, parentTaskId: null, title: 'Повторяемая задача', description: null, estimatedDurationMinutes: null, completedAt: null, createdAt, updatedAt: createdAt, deletedAt: null });
    await saveTaskPlanning(source, {
      taskId: 'task-1',
      blocks: [{ id: 'block-1', taskItemId: 'task-1', occurrenceId: null, timeZoneId: 'Europe/Moscow', startsAt: '2026-08-03T09:00:00+03:00', endsAt: '2026-08-03T10:00:00+03:00', createdAt, updatedAt: createdAt, deletedAt: null }],
      recurrence: { id: 'series-1', frequency: 'weekly', interval: 1, startsOn: '2026-08-03', createdAt },
    });

    const view = await render(<AppServicesProvider notificationScheduler={notificationScheduler} source={source} seedDevelopmentData={false}><DayDashboard selectedDate="2026-08-10" /></AppServicesProvider>);
    const recurringBlockLabel = 'Повторяемая задача, 09:00–10:00, колонка 1 из 1';
    await waitFor(() => expect(view.getByLabelText(recurringBlockLabel)).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText(recurringBlockLabel));
    await waitFor(() => expect(view.getByLabelText('Перенести этот экземпляр')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Перенести этот экземпляр'));

    await waitFor(() => {
      expect(view.getByLabelText('Перенести только выбранный экземпляр')).toBeOnTheScreen();
      expect(view.getByLabelText('Перенести всю серию')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByLabelText('Дата переноса'));
    await waitFor(() => expect(view.getByLabelText('11 Август 2026')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('11 Август 2026'));
    await waitFor(() => expect(view.getByText('11.08.2026')).toBeOnTheScreen());
    await act(async () => {
      await fireEvent.press(view.getByLabelText('Перенести только выбранный экземпляр'));
      await new Promise((resolve) => setTimeout(resolve, 1));
    });

    await waitFor(() => expect(source.debugRowExists('occurrence-series-1-2026-08-10-block-1')).toBe(true));
    await expect(source.listScheduleBlocks()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ occurrenceId: 'occurrence-series-1-2026-08-10', startsAt: '2026-08-11T09:00:00+03:00' }),
    ]));
  });
});
