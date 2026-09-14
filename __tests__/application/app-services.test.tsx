import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import { useEffect } from 'react';

import {
  AppServicesProvider,
  useAppServices,
} from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { getDefaultSettings } from '../../src/data/default-settings';
import { createTask } from '../../src/application/backlog-use-cases';
import type { SyncEngine } from '../../src/application/sync-engine';

const mockSyncGateway = {
  push: jest.fn(),
  pull: jest.fn(),
  getDataGeneration: jest.fn(),
};

jest.mock('../../src/data/supabase-sync-gateway', () => ({
  createSupabaseSyncGateway: jest.fn(() => mockSyncGateway),
}));

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

function TimeZoneChangeProbe() {
  const { isReady, settingsActions } = useAppServices();
  if (!isReady) return <Text>loading timezone change</Text>;
  return <Pressable onPress={() => void settingsActions.updateTimeZone('Asia/Ho_Chi_Minh')}><Text>Сменить пояс</Text></Pressable>;
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

function AccountClearProbe() {
  const { clearAccountData, isReady } = useAppServices();
  if (!isReady) return <Text>loading account clear</Text>;
  return <Pressable onPress={() => void clearAccountData(2)}><Text>Очистить облачную реплику</Text></Pressable>;
}

function BootReadinessProbe({ events }: { events: string[] }) {
  const { isReady } = useAppServices();

  useEffect(() => {
    if (isReady) events.push('provider.ready');
  }, [events, isReady]);

  return <Text>{isReady ? 'локальная копия готова' : 'локальная копия загружается'}</Text>;
}

function AutomaticSyncStatusProbe({ onCreate }: { onCreate: () => Promise<void> }) {
  const { isReady, runBacklogAction, syncStatus } = useAppServices();
  if (!isReady) return <Text>загрузка статуса</Text>;
  return <View>
    <Text>{`${syncStatus.pendingCount}:${syncStatus.lastSuccessAt === null ? 'нет' : 'есть'}`}</Text>
    <Pressable onPress={() => void runBacklogAction(onCreate)}><Text>Создать проект для автоматической синхронизации</Text></Pressable>
  </View>;
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
      await fireEvent.press(view.getByText('Создать задачу'));
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
      await fireEvent.press(view.getByText('manual'));
    });

    await waitFor(async () => {
      expect(view.getByText('device')).toBeOnTheScreen();
      await expect(source.getSettings()).resolves.toMatchObject({ timeZoneMode: 'device' });
    });
  });

  test('rebuilds local schedule notifications in the newly effective device timezone', async () => {
    const source = createInMemoryDataSource();
    const notificationScheduler = { schedule: jest.fn().mockResolvedValue('notification-1'), cancel: jest.fn() };
    await source.saveTaskItem({ id: 'timezone-task', kind: 'task', projectId: null, parentTaskId: null, title: 'Созвон', description: null, estimatedDurationMinutes: null, scheduledOn: null, periodStartOn: null, periodEndOn: null, completedAt: null, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', deletedAt: null });
    await source.saveScheduleBlock({ id: 'timezone-block', taskItemId: 'timezone-task', occurrenceId: null, notificationId: null, timeZoneId: 'Europe/Moscow', startsAt: '2030-09-01T10:00:00+03:00', endsAt: '2030-09-01T11:00:00+03:00', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', deletedAt: null });
    const view = await render(<AppServicesProvider source={source} seedDevelopmentData={false} notificationScheduler={notificationScheduler}><TimeZoneChangeProbe /></AppServicesProvider>);
    await waitFor(() => expect(view.getByText('Сменить пояс')).toBeOnTheScreen());
    notificationScheduler.schedule.mockClear();

    await fireEvent.press(view.getByText('Сменить пояс'));

    await waitFor(() => expect(notificationScheduler.schedule).toHaveBeenCalledWith(expect.objectContaining({ body: 'Созвон начнётся в 14:00' })));
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
      await fireEvent.press(view.getByText('08:00-22:00:21:00:10'));
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

  test('replaces the current account replica with the generation returned by a successful cloud clear', async () => {
    const source = createInMemoryDataSource({ kind: 'account', accountId: 'account-a' }) as unknown as {
      getLocalDataGeneration(): Promise<number>;
      getProject(id: string): Promise<unknown>;
      saveProject(project: { id: string; title: string; description: null; completedAt: null; createdAt: string; updatedAt: string; deletedAt: null }): Promise<void>;
    };
    await source.saveProject({ id: 'project-a', title: 'Удаляемая задача', description: null, completedAt: null, createdAt: '2026-09-04T10:00:00.000Z', updatedAt: '2026-09-04T10:00:00.000Z', deletedAt: null });
    const view = await render(<AppServicesProvider source={source as never} seedDevelopmentData={false}><AccountClearProbe /></AppServicesProvider>);

    await waitFor(() => expect(view.getByText('Очистить облачную реплику')).toBeOnTheScreen());
    await fireEvent.press(view.getByText('Очистить облачную реплику'));

    await waitFor(async () => {
      await expect(source.getProject('project-a')).resolves.toBeNull();
      await expect(source.getLocalDataGeneration()).resolves.toBe(2);
    });
  });

  test('opens the local replica before an initial account sync resolves', async () => {
    const events: string[] = [];
    const source = createInMemoryDataSource({ kind: 'account', accountId: 'account-17' });
    const initialize = source.initialize.bind(source);
    const getSettings = source.getSettings.bind(source);
    const listTaskItems = source.listTaskItems.bind(source);
    let recordedInitialize = false;
    let recordedSettingsRead = false;
    let recordedBacklogRead = false;
    source.initialize = async () => {
      if (!recordedInitialize) {
        recordedInitialize = true;
        events.push('source.initialize');
      }
      await initialize();
    };
    source.getSettings = async () => {
      if (!recordedSettingsRead) {
        recordedSettingsRead = true;
        events.push('settings.get');
      }
      return getSettings();
    };
    source.listTaskItems = async () => {
      if (!recordedBacklogRead) {
        recordedBacklogRead = true;
        events.push('backlog.read');
      }
      return listTaskItems();
    };

    let releaseSync: (() => void) | null = null;
    const syncEngine: SyncEngine = {
      syncNow: jest.fn(() => new Promise((resolve) => {
        events.push('sync.syncNow');
        releaseSync = () => resolve({ pushed: 0, pulled: 0 });
      })),
      notifyLocalMutation: jest.fn(),
      onForeground: jest.fn(),
      onNetworkReconnect: jest.fn(),
      onRealtimeSignal: jest.fn(),
      dispose: jest.fn(),
    };

    const view = await render(
      <AppServicesProvider scope={{ kind: 'account', accountId: 'account-17' }} seedDevelopmentData={false} source={source} syncEngineOverride={syncEngine}>
        <BootReadinessProbe events={events} />
      </AppServicesProvider>,
    );

    await waitFor(() => expect(view.getByText('локальная копия готова')).toBeOnTheScreen());
    await waitFor(() => expect(events).toEqual([
      'source.initialize',
      'settings.get',
      'backlog.read',
      'provider.ready',
      'sync.syncNow',
    ]));

    await act(async () => {
      releaseSync?.();
      await Promise.resolve();
    });
  });

  test('refreshes the visible sync status after a debounced local account change is synchronized', async () => {
    jest.useFakeTimers();
    try {
      const source = createInMemoryDataSource({ kind: 'account', accountId: 'account-a' });
      mockSyncGateway.push.mockImplementation(async (mutations) => ({
        mutations: mutations.map((mutation: { mutationId: string; entityType: string; entityId: string; operation: 'upsert' | 'delete' }) => ({ ...mutation, version: 1 })),
        conflicts: [],
      }));
      mockSyncGateway.pull.mockResolvedValue([]);

      const view = await render(
        <AppServicesProvider scope={{ kind: 'account', accountId: 'account-a' }} seedDevelopmentData={false} source={source}>
          <AutomaticSyncStatusProbe onCreate={() => source.saveProject({
            id: 'project-a', title: 'Проект для синхронизации', description: null, completedAt: null,
            createdAt: '2026-09-14T10:00:00.000Z', updatedAt: '2026-09-14T10:00:00.000Z', deletedAt: null,
          })} />
        </AppServicesProvider>,
      );

      await waitFor(() => expect(view.getByText('0:есть')).toBeOnTheScreen());
      await fireEvent.press(view.getByText('Создать проект для автоматической синхронизации'));
      await waitFor(() => expect(view.getByText('1:есть')).toBeOnTheScreen());
      await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
      });
      await waitFor(async () => {
        await expect(source.listSyncOutbox()).resolves.toEqual([]);
      });
      await waitFor(() => expect(view.getByText('0:есть')).toBeOnTheScreen());
    } finally {
      jest.useRealTimers();
    }
  });
});
