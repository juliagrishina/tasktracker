import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AppSettings, Project, RecurrenceOccurrence, Reminder, TaskItem } from '../domain/entities';
import { ensureAnonymousSession } from '../data/auth-session';
import type { AppDataSource } from '../data/contracts';
import { createDataSource } from '../data/data-source';
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
import { getCompletedItems, type CompletedItem } from './completed-use-cases';
import { loadDemoTaskGroups, seedDemoData } from './demo-data';
import { runPersistenceDiagnostic } from './persistence-diagnostic';
import { convertReminderToTask } from './convert-reminder-to-task';
import { getCompletionEligibility, type CompletionEligibility } from './completion-eligibility';
import { getEveningReviewItems, synchronizeEveningReviewNotification } from './evening-review';
import { localNotificationScheduler } from './local-notification-scheduler';
import { continueIncompleteTask, createTimedReminderTaskWithPlanning, getPlanScheduleBlocks, getPlanUntimedReminders, getPlanUntimedTasks, getTaskPlanningSnapshot, moveRecurrenceOccurrence, removeRecurrenceOccurrence, returnIncompleteTaskToBacklog, returnPlanItemToBacklog, returnTaskToBacklog, saveOccurrenceException, saveTaskPlanning, saveTaskWithPlanning, setRecurrenceOccurrenceState, synchronizeRecurrenceNotifications, syncReminderRecurrence } from './planning-use-cases';
import type { CreateTimedReminderTaskWithPlanningInput, MoveRecurrenceOccurrenceInput, SaveOccurrenceExceptionInput, SaveTaskPlanningInput, SaveTaskPlanningResult, SaveTaskWithPlanningInput } from './planning-types';

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
  moveRecurrenceOccurrence(input: MoveRecurrenceOccurrenceInput): Promise<{ scope: MoveRecurrenceOccurrenceInput['scope'] }>;
  removeRecurrenceOccurrence(input: { seriesId: string; occursOn: string; scope: 'occurrence' | 'series' }): Promise<void>;
}

interface SettingsActions {
  updateTimeZone(timeZoneId: string): Promise<void>;
}

interface AppServicesContextValue {
  isReady: boolean;
  projects: ProjectRepository;
  settings: AppSettings;
  settingsActions: SettingsActions;
  demoTasks: DemoTaskGroups;
  backlog: BacklogView;
  completedItems: readonly CompletedItem[];
  backlogActions: BacklogActions;
  planningActions: PlanningActions;
  refreshBacklog(): Promise<void>;
  refreshCompletedItems(): Promise<void>;
  runBacklogAction<T>(action: () => Promise<T>): Promise<T>;
  runStorageDiagnostic(): Promise<'created' | 'persisted'>;
}

interface AppServicesProviderProps {
  children: ReactNode;
  source?: AppDataSource;
  seedDevelopmentData?: boolean;
}

const AppServicesContext = createContext<AppServicesContextValue | null>(null);

const emptyBacklogView: BacklogView = {
  categoryOrder: ['reminders', 'unassigned', 'projects'],
  reminders: [],
  unassignedTasks: [],
  projects: [],
};

export function AppServicesProvider({
  children,
  source,
  seedDevelopmentData = __DEV__,
}: AppServicesProviderProps) {
  const [appSource] = useState<AppDataSource>(() => source ?? createDataSource());
  const repositories = useMemo(() => createAppRepositories(appSource), [appSource]);
  const [isReady, setIsReady] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings);
  const [demoTasks, setDemoTasks] = useState<DemoTaskGroups>(emptyDemoTaskGroups);
  const [backlog, setBacklog] = useState<BacklogView>(emptyBacklogView);
  const [completedItems, setCompletedItems] = useState<readonly CompletedItem[]>([]);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const runStorageDiagnostic = useCallback(
    () => runPersistenceDiagnostic(appSource),
    [appSource],
  );
  const refreshBacklog = useCallback(async () => {
    const loadedBacklog = await getBacklogView(appSource);
    setBacklog(loadedBacklog);
  }, [appSource]);
  const refreshCompletedItems = useCallback(async () => {
    setCompletedItems(await getCompletedItems(appSource));
  }, [appSource]);
  const runBacklogAction = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      const result = await action();
      await Promise.all([refreshBacklog(), refreshCompletedItems()]);
      return result;
    },
    [refreshBacklog, refreshCompletedItems],
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
        runBacklogAction(() => completeBacklogItem(appSource, input, localNotificationScheduler)),
      resumeItem: (input) => runBacklogAction(() => resumeBacklogItem(appSource, input)),
      deleteItem: (input) =>
        runBacklogAction(() => deleteBacklogItem(appSource, input, localNotificationScheduler)),
    }),
    [appSource, runBacklogAction],
  );
  const planningActions = useMemo<PlanningActions>(
    () => ({
      getTaskItem: (taskId) => appSource.getTaskItem(taskId),
      getRecurrenceOccurrence: async (seriesId, occursOn) => (await appSource.listRecurrenceOccurrences(seriesId)).find((occurrence) => occurrence.occursOn === occursOn) ?? null,
      getRecurrenceOccurrenceById: (id) => appSource.getRecurrenceOccurrence(id),
      convertReminderToTask: (reminderId, taskId, createdAt) => convertReminderToTask(appSource, { reminderId, taskId, createdAt }),
      getPlanScheduleBlocks: (isoDate) => getPlanScheduleBlocks(appSource, isoDate),
      getTaskPlanningSnapshot: (taskId) => getTaskPlanningSnapshot(appSource, taskId),
      getCompletionEligibility: (now) => getCompletionEligibility(appSource, now),
      setRecurrenceOccurrenceState: async (seriesId, occursOn, state) => {
        await setRecurrenceOccurrenceState(appSource, seriesId, occursOn, state);
        void synchronizeRecurrenceNotifications(appSource, localNotificationScheduler, new Date()).catch(() => {});
        await refreshCompletedItems();
      },
      getPlanUntimedReminders: (isoDate) => getPlanUntimedReminders(appSource, isoDate),
      getPlanUntimedTasks: (isoDate) => getPlanUntimedTasks(appSource, isoDate),
      getEveningReviewItems: (isoDate) => getEveningReviewItems(appSource, isoDate),
      continueIncompleteTask: (input) => continueIncompleteTask(appSource, input, localNotificationScheduler),
      returnIncompleteTaskToBacklog: (input) => runBacklogAction(() => returnIncompleteTaskToBacklog(appSource, input, localNotificationScheduler)),
      returnPlanItemToBacklog: (input) => runBacklogAction(() => returnPlanItemToBacklog(appSource, input, localNotificationScheduler)),
      returnTaskToBacklog: (input) => runBacklogAction(() => returnTaskToBacklog(appSource, input, localNotificationScheduler)),
      syncReminderRecurrence: (reminderId) => syncReminderRecurrence(appSource, reminderId),
      saveTaskPlanning: (input) => saveTaskPlanning(appSource, input, localNotificationScheduler),
      saveTaskWithPlanning: (input) => runBacklogAction(() => saveTaskWithPlanning(appSource, input, localNotificationScheduler)),
      createTimedReminderTaskWithPlanning: (input) => runBacklogAction(() => createTimedReminderTaskWithPlanning(appSource, input, localNotificationScheduler)),
      saveOccurrenceException: (input) => saveOccurrenceException(appSource, input, localNotificationScheduler),
      moveRecurrenceOccurrence: (input) => moveRecurrenceOccurrence(appSource, input, localNotificationScheduler),
      removeRecurrenceOccurrence: (input) => removeRecurrenceOccurrence(appSource, input, localNotificationScheduler),
    }),
    [appSource, refreshCompletedItems, runBacklogAction],
  );
  const settingsActions = useMemo<SettingsActions>(
    () => ({
      updateTimeZone: async (timeZoneId) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: timeZoneId });
        } catch {
          throw new Error('Укажите корректный часовой пояс IANA, например Europe/Berlin');
        }
        const updatedSettings = { ...settings, timeZoneId };
        await appSource.saveSettings(updatedSettings);
        setSettings(updatedSettings);
      },
    }),
    [appSource, settings],
  );

  useEffect(() => {
    // Устанавливаем облачную identity независимо от локальной инициализации:
    // приложение остаётся local-first и не должно ждать сеть/Supabase.
    void ensureAnonymousSession().catch(() => {});
  }, []);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        await appSource.initialize();
        if (seedDevelopmentData) {
          await seedDemoData(appSource);
        }
        const loadedSettings = await repositories.settings.get();
        const loadedDemoTasks = seedDevelopmentData
          ? await loadDemoTaskGroups(appSource)
          : emptyDemoTaskGroups;
        const loadedBacklog = await getBacklogView(appSource);
        const loadedCompletedItems = await getCompletedItems(appSource);
        void synchronizeRecurrenceNotifications(appSource, localNotificationScheduler, new Date()).catch(() => {});
        void synchronizeEveningReviewNotification({ now: new Date(), scheduler: localNotificationScheduler, source: appSource }).catch(() => {});

        if (isMounted) {
          setSettings(loadedSettings);
          setDemoTasks(loadedDemoTasks);
          setBacklog(loadedBacklog);
          setCompletedItems(loadedCompletedItems);
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
  }, [appSource, repositories, seedDevelopmentData]);

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
        demoTasks,
        backlog,
        completedItems,
        backlogActions,
        planningActions,
        refreshBacklog,
        refreshCompletedItems,
        runBacklogAction,
        runStorageDiagnostic,
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
