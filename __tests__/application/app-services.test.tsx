import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

import {
  AppServicesProvider,
  useAppServices,
} from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { getDefaultSettings } from '../../src/data/default-settings';
import { createTask } from '../../src/application/backlog-use-cases';

function ServicesProbe() {
  const { demoTasks, isReady, settings } = useAppServices();

  if (!isReady) {
    return <Text>loading</Text>;
  }

  return (
    <Text>{`${settings.notificationLeadMinutes}:${demoTasks.plan[0]?.title ?? 'нет данных'}`}</Text>
  );
}

function BacklogProbe({ onCreate }: { onCreate: () => Promise<unknown> }) {
  const { backlog, isReady, runBacklogAction } = useAppServices();

  if (!isReady) {
    return <Text>loading backlog</Text>;
  }

  return (
    <View>
      <Text>{`unassigned:${backlog.unassignedTasks.map((item) => item.task.title).join(',')}`}</Text>
      <Pressable onPress={async () => runBacklogAction(onCreate)}>
        <Text>Создать задачу</Text>
      </Pressable>
    </View>
  );
}

function TimeZoneModeProbe() {
  const { isReady, settings, settingsActions } = useAppServices();

  if (!isReady) {
    return <Text>loading timezone</Text>;
  }

  return (
    <Pressable onPress={() => void settingsActions.useDeviceTimeZone()}>
      <Text>{settings.timeZoneMode}</Text>
    </Pressable>
  );
}

function PlanningSettingsProbe() {
  const { isReady, settings, settingsActions } = useAppServices();

  if (!isReady) {
    return <Text>loading planning settings</Text>;
  }

  return (
    <Pressable onPress={() => void settingsActions.updatePlanningSettings({
      workdayStartsAt: '09:00',
      workdayEndsAt: '18:00',
      eveningReviewAt: '20:00',
      notificationLeadMinutes: 30,
    })}>
      <Text>{`${settings.workdayStartsAt}-${settings.workdayEndsAt}:${settings.eveningReviewAt}:${settings.notificationLeadMinutes}`}</Text>
    </Pressable>
  );
}

describe('AppServicesProvider', () => {
  test('exposes seeded settings and Plan demo data after initialization', async () => {
    const view = await render(
      <AppServicesProvider source={createInMemoryDataSource()}>
        <ServicesProbe />
      </AppServicesProvider>,
    );

    expect(view.getByText('15:Подготовить черновик недели')).toBeOnTheScreen();
  });

  test('refreshes the backlog view after a successful backlog action', async () => {
    const source = createInMemoryDataSource();
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <BacklogProbe
          onCreate={() =>
            createTask(source, {
              id: 'new-task',
              title: 'Новая задача',
              createdAt: '2026-08-02T10:00:00.000Z',
            })
          }
        />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByText('unassigned:')).toBeOnTheScreen();
    });

    await act(async () => {
      fireEvent.press(view.getByText('Создать задачу'));
    });

    await waitFor(() => {
      expect(view.getByText('unassigned:Новая задача')).toBeOnTheScreen();
    });
  });

  test('returns a manual timezone preference to device mode', async () => {
    const source = createInMemoryDataSource();
    await source.saveSettings({ ...getDefaultSettings(), timeZoneId: 'Europe/Berlin', timeZoneMode: 'manual' });
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <TimeZoneModeProbe />
      </AppServicesProvider>,
    );

    await waitFor(() => expect(view.getByText('manual')).toBeOnTheScreen());
    await act(async () => {
      fireEvent.press(view.getByText('manual'));
    });

    await waitFor(async () => {
      expect(view.getByText('device')).toBeOnTheScreen();
      await expect(source.getSettings()).resolves.toMatchObject({ timeZoneMode: 'device' });
    });
  });

  test('exposes an action that persists planning settings', async () => {
    const source = createInMemoryDataSource();
    const notificationScheduler = { schedule: jest.fn(), cancel: jest.fn() };
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false} notificationScheduler={notificationScheduler}>
        <PlanningSettingsProbe />
      </AppServicesProvider>,
    );

    await waitFor(() => expect(view.getByText('08:00-22:00:21:00:10')).toBeOnTheScreen());
    await act(async () => {
      fireEvent.press(view.getByText('08:00-22:00:21:00:10'));
    });

    await waitFor(async () => {
      expect(view.getByText('09:00-18:00:20:00:30')).toBeOnTheScreen();
      await expect(source.getSettings()).resolves.toMatchObject({
        workdayStartsAt: '09:00',
        workdayEndsAt: '18:00',
        eveningReviewAt: '20:00',
        notificationLeadMinutes: 30,
      });
    });
  });
});
