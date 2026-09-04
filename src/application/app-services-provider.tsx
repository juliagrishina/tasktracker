import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';

import type { AppSettings, DailyEnergyEntry, Project, RecurrenceOccurrence, RecurrenceRevision, RecurrenceSeries, Reminder, TaskItem } from '../domain/entities';
import type { AppDataSource } from '../data/contracts';
import { createDataSource } from '../data/data-source';
import type { LocalDataScope } from '../data/local-data-scopes';
import { clearAutonomousWorkspace } from './local-workspace-management';
import { getDefaultSettings } from '../data/default-settings';
import { ProjectRepository } from '../data/repositories/project-repository';
import {
  emptyDemoTaskGroups,
  type DemoTaskGroups,
} from '../ui/demo-tasks';

import { createAppRepositories } from './app-services';
import type {
  BacklogView,
  CompleteBacklogItemInput,
  CreateFollowUpReminderInput,
  CreateProjectInput,
  CreateReminderInput,
  CreateSubtaskInput,
  CreateTaskInput,
  DeleteBacklogItemInput,
  MoveTaskToProjectInput,
  ResumeBacklogItemInput,
  UpdateProjectInput,
  UpdateReminderInput,
  UpdateTaskItemInput,
} from './backlog-types';
import {
  completeBacklogItem,
  createFollowUpReminder,
  createProject,
  createReminder,
  createSubtask,
  createTask,
  deleteBacklogItem,
  getBacklogView,
  moveTaskToProject,
  resumeBacklogItem,
  updateProject,
  updateReminder,
  updateTaskItem,
} from './backlog-use-cases';
import { getCompletedItemDetails, getCompletedItems, permanentlyDeleteCompletedItem, permanentlyDeleteCompletedSeries, type CompletedItem, type CompletedItemDetails } from './completed-use-cases';
import { loadDemoTaskGroups, seedDemoData } from './demo-data';
import { runPersistenceDiagnostic } from './persistence-diagnostic';
import { convertReminderToTask } from './convert-reminder-to-task';
import { getCompletionEligibility, type CompletionEligibility } from './completion-eligibility';
import { getEveningReviewItems, synchronizeEveningReviewNotification } from './evening-review';
import { localNotificationScheduler } from './local-notification-scheduler';
import type { LocalNotificationScheduler } from './notification-scheduling';
import { continueIncompleteTask, createTimedReminderTaskWithPlanning, getPlanScheduleBlocks, getPlanUntimedReminders, getPlanUntimedTasks, getTaskPlanningSnapshot, moveRecurrenceOccurrence, removeRecurrenceOccurrence, returnIncompleteTaskToBacklog, returnPlanItemToBacklog, returnTaskToBacklog, saveOccurrenceException, saveRecurrenceRevision, saveTaskPlanning, saveTaskWithPlanning, setRecurrenceOccurrenceState, synchronizeRecurrenceNotifications, syncReminderRecurrence } from './planning-use-cases';
import type { CreateTimedReminderTaskWithPlanningInput, MoveRecurrenceOccurrenceInput, SaveOccurrenceExceptionInput, SaveRecurrenceRevisionInput, SaveTaskPlanningInput, SaveTaskPlanningResult, SaveTaskWithPlanningInput } from './planning-types';
import { updatePlanningSettings, type UpdatePlanningSettingsInput } from './settings-use-cases';
import { getDailyEnergyForCurrentDay, saveDailyEnergyForCurrentDay } from './energy-use-cases';
import { createSupabaseSyncGateway } from '../data/supabase-sync-gateway';
import { supabase } from '../data/supabase-client';
import { createSyncEngine, type SyncActivityState, type SyncEngine, type SyncEngineStore } from './sync-engine';
import { resolveSyncConflict, type SyncConflictDecision } from './sync-conflicts';
import type { SyncConflict } from '../data/sync-outbox';

interface BacklogActions {
  createProject(input: CreateProjectInput): Promise<Project>;
  createTask(input: CreateTaskInput): Promise<Extract<TaskItem, { kind: 'task' }>>;
  createSubtask(input: CreateSubtaskInput): Promise<Extract<TaskItem, { kind: 'subtask' }>>;
  createReminder(input: CreateReminderInput): Promise<Reminder>;
  createFollowUpReminder(input: CreateFollowUpReminderInput): Promise<Reminder>;
  updateProject(input: UpdateProjectInput): Promise<Project>;
  updateTaskItem(input: UpdateTaskItemInput): Promise<TaskItem>;
  updateReminder(input: UpdateReminderInput): Promise<Reminder>;
  moveTaskToProject(input: MoveTaskToProjectInput): Promise<void>;
  completeItem(input: CompleteBacklogItemInput): Promise<void>;
  resumeItem(input: ResumeBacklogItemInput): Promise<void>;
  deleteItem(input: DeleteBacklogItemInput): Promise<void>;
}

interface PlanningActions {
  getTaskItem(taskId: string): Promise<TaskItem | null>;
  getRecurrenceOccurrence(seriesId: string, occursOn: string): Promise<RecurrenceOccurrence | null>;
  getRecurrenceOccurrenceById(id: string): Promise<RecurrenceOccurrence | null>;
  getRecurrenceSeries(seriesId: string): Promise<RecurrenceSeries | null>;
  getRecurrenceRevisions(seriesId: string): Promise<readonly RecurrenceRevision[]>;
  convertReminderToTask(reminderId: string, taskId: string, createdAt: string): ReturnType<typeof convertReminderToTask>;
  getPlanScheduleBlocks(isoDate: string): ReturnType<typeof getPlanScheduleBlocks>;
  getTaskPlanningSnapshot(taskId: string): ReturnType<typeof getTaskPlanningSnapshot>;
  getCompletionEligibility(now?: Date): Promise<readonly CompletionEligibility[]>;
  setRecurrenceOccurrenceState(seriesId: string, occursOn: string, state: 'active' | 'completed' | 'cancelled'): Promise<void>;
  getPlanUntimedReminders(isoDate: string): ReturnType<typeof getPlanUntimedReminders>;
  getPlanUntimedTasks(isoDate: string): ReturnType<typeof getPlanUntimedTasks>;
  getEveningReviewItems(isoDate: string): ReturnType<typeof getEveningReviewItems>;
  continueIncompleteTask(input: { taskId: string; occurrence: { seriesId: string; occursOn: string } | null; now?: Date }): Promise<void>;
  returnIncompleteTaskToBacklog(input: { taskId: string; occurrence: { seriesId: string; occursOn: string } | null; reason: string | null }): Promise<void>;
  returnPlanItemToBacklog(input: Parameters<typeof returnPlanItemToBacklog>[1]): Promise<void>;
  returnTaskToBacklog(input: { taskId: string; reason: string | null }): Promise<void>;
  syncReminderRecurrence(reminderId: string): Promise<void>;
  saveTaskPlanning(input: SaveTaskPlanningInput): Promise<SaveTaskPlanningResult>;
  saveTaskWithPlanning(input: SaveTaskWithPlanningInput): Promise<SaveTaskPlanningResult>;
  createTimedReminderTaskWithPlanning(input: CreateTimedReminderTaskWithPlanningInput): Promise<SaveTaskPlanningResult>;
  saveOccurrenceException(input: SaveOccurrenceExceptionInput): Promise<void>;
  saveRecurrenceRevision(input: SaveRecurrenceRevisionInput): Promise<void>;
  moveRecurrenceOccurrence(input: MoveRecurrenceOccurrenceInput): Promise<{ scope: MoveRecurrenceOccurrenceInput['scope'] }>;
  removeRecurrenceOccurrence(input: { seriesId: string; occursOn: string; scope: 'occurrence' | 'series' }): Promise<void>;
}

interface SettingsActions {
  updateTimeZone(timeZoneId: string): Promise<void>;
  useDeviceTimeZone(): Promise<void>;
  updatePlanningSettings(input: UpdatePlanningSettingsInput): Promise<void>;
  deferCompletionPromptsUntil(isoDate: string): Promise<void>;
}

interface EnergyActions {
  refreshDailyEnergy(): Promise<DailyEnergyEntry | null>;
  saveDailyEnergy(energyPercent: number | null): Promise<DailyEnergyEntry>;
}

interface AppServicesContextValue {
  isReady: boolean;
  projects: ProjectRepository;
  settings: AppSettings;
  settingsActions: SettingsActions;
  dailyEnergy: DailyEnergyEntry | null;
  isDailyEnergyLoaded: boolean;
  energyActions: EnergyActions;
  demoTasks: DemoTaskGroups;
  backlog: BacklogView;
  completedItems: readonly CompletedItem[];
  getCompletedItemDetails(item: CompletedItem): Promise<CompletedItemDetails | null>;
  deleteCompletedItem(item: CompletedItem): Promise<void>;
  deleteCompletedSeries(item: CompletedItem): Promise<void>;
  backlogActions: BacklogActions;
  planningActions: PlanningActions;
  refreshBacklog(): Promise<void>;
  refreshCompletedItems(): Promise<void>;
  runBacklogAction<T>(action: () => Promise<T>): Promise<T>;
  runStorageDiagnostic(): Promise<'created' | 'persisted'>;
  syncAccountData(): Promise<void>;
  syncStatus: AccountSyncStatus;
  syncConflicts: readonly SyncConflict[];
  resolveAccountSyncConflict(conflict: SyncConflict, decision: SyncConflictDecision): Promise<void>;
  clearAutonomousData(): Promise<void>;
  clearAccountData(dataGeneration?: number): Promise<void>;
}

interface AppServicesProviderProps {
  children: ReactNode;
  source?: AppDataSource;
  scope?: LocalDataScope;
  seedDevelopmentData?: boolean;
  notificationScheduler?: LocalNotificationScheduler;
}

const AppServicesContext = createContext<AppServicesContextValue | null>(null);

const emptyBacklogView: BacklogView = {
  categoryOrder: ['reminders', 'unassigned', 'projects'],
  reminders: [],
  unassignedTasks: [],
  projects: [],
};

function isSyncEngineStore(source: AppDataSource): source is AppDataSource & SyncEngineStore {
  const candidate = source as Partial<SyncEngineStore>;
  return typeof candidate.listSyncOutbox === 'function'
    && typeof candidate.acknowledgeSyncMutations === 'function'
    && typeof candidate.getSyncCursor === 'function'
    && typeof candidate.applyRemoteSyncChanges === 'function';
}

export interface AccountSyncStatus {
  kind: SyncActivityState['kind'];
  pendingCount: number;
  lastSuccessAt: string | null;
}

function isSyncConflictStore(source: AppDataSource): source is AppDataSource & SyncEngineStore & {
  listSyncConflicts(): Promise<readonly SyncConflict[]>;
  removeSyncConflict(id: string): Promise<void>;
  enqueueSyncMutation: Parameters<typeof resolveSyncConflict>[0]['enqueueSyncMutation'];
} {
  const candidate = source as Partial<SyncEngineStore> & { listSyncConflicts?: unknown; removeSyncConflict?: unknown; enqueueSyncMutation?: unknown };
  return isSyncEngineStore(source)
    && typeof candidate.listSyncConflicts === 'function'
    && typeof candidate.removeSyncConflict === 'function'
    && typeof candidate.enqueueSyncMutation === 'function';
}

function isSyncStatusStore(source: AppDataSource): source is AppDataSource & SyncEngineStore & {
  getLastSyncSuccessAt(): Promise<string | null>;
} {
  const candidate = source as Partial<SyncEngineStore> & { getLastSyncSuccessAt?: unknown };
  return isSyncEngineStore(source) && typeof candidate.getLastSyncSuccessAt === 'function';
}

function isSyncResetStore(source: AppDataSource): source is AppDataSource & SyncEngineStore & {
  resetForFullResync(dataGeneration: number): Promise<void>;
} {
  const candidate = source as Partial<SyncEngineStore>;
  return isSyncEngineStore(source) && typeof candidate.resetForFullResync === 'function';
}

export function AppServicesProvider({
  children,
  source,
  scope,
  seedDevelopmentData = __DEV__,
  notificationScheduler = localNotificationScheduler,
}: AppServicesProviderProps) {
  const [appSource] = useState<AppDataSource>(() => source ?? createDataSource(scope));
  const [syncStatus, setSyncStatus] = useState<AccountSyncStatus>({ kind: 'synchronized', pendingCount: 0, lastSuccessAt: null });
  const syncEngine = useMemo<SyncEngine | null>(() => {
    if (scope?.kind !== 'account' || !isSyncEngineStore(appSource)) return null;
    return createSyncEngine({ gateway: createSupabaseSyncGateway(supabase), store: appSource, onStateChange: ({ kind }) => setSyncStatus((current) => ({ ...current, kind })) });
  }, [appSource, scope]);
  const repositories = useMemo(() => createAppRepositories(appSource), [appSource]);
  const [isReady, setIsReady] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings);
  const [dailyEnergy, setDailyEnergy] = useState<DailyEnergyEntry | null>(null);
  const [isDailyEnergyLoaded, setIsDailyEnergyLoaded] = useState(false);
  const [demoTasks, setDemoTasks] = useState<DemoTaskGroups>(emptyDemoTaskGroups);
  const [backlog, setBacklog] = useState<BacklogView>(emptyBacklogView);
  const [completedItems, setCompletedItems] = useState<readonly CompletedItem[]>([]);
  const [syncConflicts, setSyncConflicts] = useState<readonly SyncConflict[]>([]);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const runStorageDiagnostic = useCallback(
    () => runPersistenceDiagnostic(appSource),
    [appSource],
  );
  const refreshDailyEnergy = useCallback(async () => {
    const entry = await getDailyEnergyForCurrentDay(appSource);
    setDailyEnergy(entry);
    setIsDailyEnergyLoaded(true);
    return entry;
  }, [appSource]);
  const refreshBacklog = useCallback(async () => {
    const loadedBacklog = await getBacklogView(appSource);
    setBacklog(loadedBacklog);
  }, [appSource]);
  const refreshCompletedItems = useCallback(async () => {
    setCompletedItems(await getCompletedItems(appSource));
  }, [appSource]);
  const refreshSyncConflicts = useCallback(async () => {
    if (isSyncConflictStore(appSource)) setSyncConflicts(await appSource.listSyncConflicts());
  }, [appSource]);
  const refreshSyncStatus = useCallback(async () => {
    if (!isSyncStatusStore(appSource)) return;
    const [outbox, lastSuccessAt] = await Promise.all([appSource.listSyncOutbox(), appSource.getLastSyncSuccessAt()]);
    setSyncStatus((current) => ({ ...current, pendingCount: outbox.length, lastSuccessAt }));
  }, [appSource]);
  const runBacklogAction = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      const result = await action();
      await Promise.all([refreshBacklog(), refreshCompletedItems()]);
      syncEngine?.notifyLocalMutation();
      await refreshSyncStatus();
      return result;
    },
    [refreshBacklog, refreshCompletedItems, refreshSyncStatus, syncEngine],
  );
  const backlogActions = useMemo<BacklogActions>(
    () => ({
      createProject: (input) =>
        runBacklogAction(() => createProject(appSource, input)),
      createTask: (input) => runBacklogAction(() => createTask(appSource, input)),
      createSubtask: (input) =>
        runBacklogAction(() => createSubtask(appSource, input)),
      createReminder: (input) =>
        runBacklogAction(() => createReminder(appSource, input)),
      createFollowUpReminder: (input) =>
        runBacklogAction(() => createFollowUpReminder(appSource, input)),
      updateProject: (input) =>
        runBacklogAction(() => updateProject(appSource, input)),
      updateTaskItem: (input) =>
        runBacklogAction(() => updateTaskItem(appSource, input)),
      updateReminder: (input) =>
        runBacklogAction(() => updateReminder(appSource, input)),
      moveTaskToProject: (input) =>
        runBacklogAction(() => moveTaskToProject(appSource, input)),
      completeItem: (input) =>
        runBacklogAction(() => completeBacklogItem(appSource, input, notificationScheduler)),
      resumeItem: (input) => runBacklogAction(() => resumeBacklogItem(appSource, input)),
      deleteItem: (input) =>
        runBacklogAction(() => deleteBacklogItem(appSource, input, notificationScheduler)),
    }),
    [appSource, notificationScheduler, runBacklogAction],
  );
  const planningActions = useMemo<PlanningActions>(
    () => ({
      getTaskItem: (taskId) => appSource.getTaskItem(taskId),
      getRecurrenceOccurrence: async (seriesId, occursOn) => (await appSource.listRecurrenceOccurrences(seriesId)).find((occurrence) => occurrence.occursOn === occursOn) ?? null,
      getRecurrenceOccurrenceById: (id) => appSource.getRecurrenceOccurrence(id),
      getRecurrenceSeries: (seriesId) => appSource.getRecurrenceSeries(seriesId),
      getRecurrenceRevisions: (seriesId) => appSource.listRecurrenceRevisions(seriesId),
      convertReminderToTask: (reminderId, taskId, createdAt) => convertReminderToTask(appSource, { reminderId, taskId, createdAt }),
      getPlanScheduleBlocks: (isoDate) => getPlanScheduleBlocks(appSource, isoDate),
      getTaskPlanningSnapshot: (taskId) => getTaskPlanningSnapshot(appSource, taskId),
      getCompletionEligibility: (now) => getCompletionEligibility(appSource, now),
      setRecurrenceOccurrenceState: async (seriesId, occursOn, state) => {
        await setRecurrenceOccurrenceState(appSource, seriesId, occursOn, state);
        void synchronizeRecurrenceNotifications(appSource, notificationScheduler, new Date()).catch(() => {});
        await refreshCompletedItems();
      },
      getPlanUntimedReminders: (isoDate) => getPlanUntimedReminders(appSource, isoDate),
      getPlanUntimedTasks: (isoDate) => getPlanUntimedTasks(appSource, isoDate),
      getEveningReviewItems: (isoDate) => getEveningReviewItems(appSource, isoDate),
      continueIncompleteTask: (input) => continueIncompleteTask(appSource, input, notificationScheduler),
      returnIncompleteTaskToBacklog: (input) => runBacklogAction(() => returnIncompleteTaskToBacklog(appSource, input, notificationScheduler)),
      returnPlanItemToBacklog: (input) => runBacklogAction(() => returnPlanItemToBacklog(appSource, input, notificationScheduler)),
      returnTaskToBacklog: (input) => runBacklogAction(() => returnTaskToBacklog(appSource, input, notificationScheduler)),
      syncReminderRecurrence: (reminderId) => syncReminderRecurrence(appSource, reminderId),
      saveTaskPlanning: (input) => saveTaskPlanning(appSource, input, notificationScheduler),
      saveTaskWithPlanning: (input) => runBacklogAction(() => saveTaskWithPlanning(appSource, input, notificationScheduler)),
      createTimedReminderTaskWithPlanning: (input) => runBacklogAction(() => createTimedReminderTaskWithPlanning(appSource, input, notificationScheduler)),
      saveOccurrenceException: async (input) => {
        await saveOccurrenceException(appSource, input);
        void synchronizeRecurrenceNotifications(appSource, notificationScheduler, new Date()).catch(() => {});
      },
      saveRecurrenceRevision: async (input) => {
        await runBacklogAction(() => saveRecurrenceRevision(appSource, input));
        void synchronizeRecurrenceNotifications(appSource, notificationScheduler, new Date()).catch(() => {});
      },
      moveRecurrenceOccurrence: (input) => moveRecurrenceOccurrence(appSource, input, notificationScheduler),
      removeRecurrenceOccurrence: (input) => removeRecurrenceOccurrence(appSource, input, notificationScheduler),
    }),
    [appSource, notificationScheduler, refreshCompletedItems, runBacklogAction],
  );
  const settingsActions = useMemo<SettingsActions>(
    () => ({
      updateTimeZone: async (timeZoneId) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: timeZoneId });
        } catch {
          throw new Error('Укажите корректный часовой пояс IANA, например Europe/Berlin');
        }
        const updatedSettings = { ...settings, timeZoneId, timeZoneMode: 'manual' as const };
        await appSource.saveSettings(updatedSettings);
        const rescheduledSettings = await updatePlanningSettings(appSource, {
          workdayStartsAt: updatedSettings.workdayStartsAt,
          workdayEndsAt: updatedSettings.workdayEndsAt,
          eveningReviewAt: updatedSettings.eveningReviewAt,
          notificationLeadMinutes: updatedSettings.notificationLeadMinutes,
        }, notificationScheduler);
        setSettings(rescheduledSettings);
        await refreshDailyEnergy();
        syncEngine?.notifyLocalMutation();
      },
      useDeviceTimeZone: async () => {
        const updatedSettings = {
          ...settings,
          timeZoneId: getDefaultSettings().timeZoneId,
          timeZoneMode: 'device' as const,
        };
        await appSource.saveSettings(updatedSettings);
        const rescheduledSettings = await updatePlanningSettings(appSource, {
          workdayStartsAt: updatedSettings.workdayStartsAt,
          workdayEndsAt: updatedSettings.workdayEndsAt,
          eveningReviewAt: updatedSettings.eveningReviewAt,
          notificationLeadMinutes: updatedSettings.notificationLeadMinutes,
        }, notificationScheduler);
        setSettings(rescheduledSettings);
        await refreshDailyEnergy();
        syncEngine?.notifyLocalMutation();
      },
      updatePlanningSettings: async (input) => {
        const updatedSettings = await updatePlanningSettings(appSource, input, notificationScheduler);
        setSettings(updatedSettings);
        syncEngine?.notifyLocalMutation();
      },
      deferCompletionPromptsUntil: async (isoDate) => {
        const updatedSettings = { ...settings, completionPromptDeferredOn: isoDate };
        await appSource.saveSettings(updatedSettings);
        setSettings(updatedSettings);
        syncEngine?.notifyLocalMutation();
      },
    }),
    [appSource, notificationScheduler, refreshDailyEnergy, settings, syncEngine],
  );
  const energyActions = useMemo<EnergyActions>(
    () => ({
      refreshDailyEnergy,
      saveDailyEnergy: async (energyPercent) => {
        const entry = await saveDailyEnergyForCurrentDay(appSource, { energyPercent });
        setDailyEnergy(entry);
        setIsDailyEnergyLoaded(true);
        syncEngine?.notifyLocalMutation();
        return entry;
      },
    }),
    [appSource, refreshDailyEnergy, syncEngine],
  );

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        await appSource.initialize();
        if (seedDevelopmentData) {
          await seedDemoData(appSource);
        }
        await syncEngine?.syncNow().catch(() => {});
        await refreshSyncConflicts();
        await refreshSyncStatus();
        const loadedSettings = await repositories.settings.get();
        const loadedDemoTasks = seedDevelopmentData
          ? await loadDemoTaskGroups(appSource)
          : emptyDemoTaskGroups;
        const loadedBacklog = await getBacklogView(appSource);
        const loadedCompletedItems = await getCompletedItems(appSource);
        const loadedDailyEnergy = await getDailyEnergyForCurrentDay(appSource);
        void synchronizeRecurrenceNotifications(appSource, notificationScheduler, new Date()).catch(() => {});
        void synchronizeEveningReviewNotification({ now: new Date(), scheduler: notificationScheduler, source: appSource }).catch(() => {});

        if (isMounted) {
          setSettings(loadedSettings);
          setDemoTasks(loadedDemoTasks);
          setBacklog(loadedBacklog);
          setCompletedItems(loadedCompletedItems);
          setDailyEnergy(loadedDailyEnergy);
          setIsDailyEnergyLoaded(true);
          setIsReady(true);
        }
      } catch {
        if (isMounted) {
          setInitializationError('Не удалось инициализировать локальное хранилище');
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [appSource, notificationScheduler, refreshSyncConflicts, refreshSyncStatus, repositories, seedDevelopmentData, syncEngine]);

  useEffect(() => {
    if (syncEngine === null) return;
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncEngine.onForeground();
    });
    const handleOnline = (): void => syncEngine.onNetworkReconnect();
    if (Platform.OS === 'web') window.addEventListener('online', handleOnline);
    return () => {
      appStateSubscription.remove();
      if (Platform.OS === 'web') window.removeEventListener('online', handleOnline);
      syncEngine.dispose();
    };
  }, [syncEngine]);

  useEffect(() => {
    const realtimeClient = supabase;
    if (syncEngine === null || realtimeClient === null || scope?.kind !== 'account') return;
    const channel = realtimeClient
      .channel(`account-sync:${scope.accountId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sync_changes',
        filter: `user_id=eq.${scope.accountId}`,
      }, () => syncEngine.onRealtimeSignal())
      .subscribe();
    return () => { void realtimeClient.removeChannel(channel); };
  }, [scope, syncEngine]);

  if (initializationError !== null) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{initializationError}</Text>
      </View>
    );
  }

  return (
    <AppServicesContext.Provider
      value={{
        isReady,
        projects: repositories.projects,
        settings,
        settingsActions,
        dailyEnergy,
        isDailyEnergyLoaded,
        energyActions,
        demoTasks,
        backlog,
        completedItems,
        getCompletedItemDetails: (item) => getCompletedItemDetails(appSource, item),
        deleteCompletedItem: (item) => runBacklogAction(() => permanentlyDeleteCompletedItem(appSource, item, notificationScheduler)),
        deleteCompletedSeries: (item) => runBacklogAction(() => permanentlyDeleteCompletedSeries(appSource, item, notificationScheduler)),
        backlogActions,
        planningActions,
        refreshBacklog,
        refreshCompletedItems,
        runBacklogAction,
        runStorageDiagnostic,
        syncAccountData: async () => { if (syncEngine !== null) await syncEngine.syncNow(); await Promise.all([refreshSyncConflicts(), refreshSyncStatus()]); },
        syncStatus,
        syncConflicts,
        resolveAccountSyncConflict: async (conflict, decision) => {
          if (!isSyncConflictStore(appSource)) throw new Error('Хранилище конфликтов синхронизации недоступно.');
          await resolveSyncConflict(appSource, conflict, decision);
          await refreshSyncConflicts();
          syncEngine?.notifyLocalMutation();
        },
        clearAutonomousData: async () => {
          await clearAutonomousWorkspace({ scope: scope ?? { kind: 'autonomous' }, source: appSource });
          await Promise.all([refreshBacklog(), refreshCompletedItems(), refreshDailyEnergy()]);
        },
        clearAccountData: async (dataGeneration) => {
          if (dataGeneration !== undefined && isSyncResetStore(appSource)) await appSource.resetForFullResync(dataGeneration);
          else await appSource.clearAll();
          setSettings(await appSource.getSettings());
          setDemoTasks(emptyDemoTaskGroups);
          await Promise.all([refreshBacklog(), refreshCompletedItems(), refreshDailyEnergy(), refreshSyncConflicts(), refreshSyncStatus()]);
        },
      }}>
      {children}
    </AppServicesContext.Provider>
  );
}

export function useAppServices(): AppServicesContextValue {
  const services = useContext(AppServicesContext);

  if (services === null) {
    throw new Error('useAppServices должен использоваться внутри AppServicesProvider');
  }

  return services;
}

export function useOptionalAppServices(): AppServicesContextValue | null {
  return useContext(AppServicesContext);
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: '#B42318',
    fontSize: 16,
    textAlign: 'center',
  },
});
