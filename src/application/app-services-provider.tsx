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

import type { AppSettings, Project, Reminder, TaskItem } from '../domain/entities';
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
  CreateProjectInput,
  CreateReminderInput,
  CreateSubtaskInput,
  CreateTaskInput,
  DeleteBacklogItemInput,
  MoveTaskToProjectInput,
  UpdateProjectInput,
  UpdateReminderInput,
  UpdateTaskItemInput,
} from './backlog-types';
import {
  completeBacklogItem,
  createProject,
  createReminder,
  createSubtask,
  createTask,
  deleteBacklogItem,
  getBacklogView,
  moveTaskToProject,
  updateProject,
  updateReminder,
  updateTaskItem,
} from './backlog-use-cases';
import { loadDemoTaskGroups, seedDemoData } from './demo-data';
import { runPersistenceDiagnostic } from './persistence-diagnostic';
import { convertReminderToTask } from './convert-reminder-to-task';
import { createTimedReminderTaskWithPlanning, getPlanScheduleBlocks, getPlanUntimedReminders, getTaskPlanningSnapshot, moveRecurrenceOccurrence, saveOccurrenceException, saveTaskPlanning, saveTaskWithPlanning, setRecurrenceOccurrenceState, syncReminderRecurrence } from './planning-use-cases';
import type { CreateTimedReminderTaskWithPlanningInput, MoveRecurrenceOccurrenceInput, SaveOccurrenceExceptionInput, SaveTaskPlanningInput, SaveTaskPlanningResult, SaveTaskWithPlanningInput } from './planning-types';

interface BacklogActions {
  createProject(input: CreateProjectInput): Promise<Project>;
  createTask(input: CreateTaskInput): Promise<Extract<TaskItem, { kind: 'task' }>>;
  createSubtask(input: CreateSubtaskInput): Promise<Extract<TaskItem, { kind: 'subtask' }>>;
  createReminder(input: CreateReminderInput): Promise<Reminder>;
  updateProject(input: UpdateProjectInput): Promise<Project>;
  updateTaskItem(input: UpdateTaskItemInput): Promise<TaskItem>;
  updateReminder(input: UpdateReminderInput): Promise<Reminder>;
  moveTaskToProject(input: MoveTaskToProjectInput): Promise<void>;
  completeItem(input: CompleteBacklogItemInput): Promise<void>;
  deleteItem(input: DeleteBacklogItemInput): Promise<void>;
}

interface PlanningActions {
  convertReminderToTask(reminderId: string, taskId: string, createdAt: string): ReturnType<typeof convertReminderToTask>;
  getPlanScheduleBlocks(isoDate: string): ReturnType<typeof getPlanScheduleBlocks>;
  getTaskPlanningSnapshot(taskId: string): ReturnType<typeof getTaskPlanningSnapshot>;
  setRecurrenceOccurrenceState(seriesId: string, occursOn: string, state: 'completed' | 'cancelled'): Promise<void>;
  getPlanUntimedReminders(isoDate: string): ReturnType<typeof getPlanUntimedReminders>;
  syncReminderRecurrence(reminderId: string): Promise<void>;
  saveTaskPlanning(input: SaveTaskPlanningInput): Promise<SaveTaskPlanningResult>;
  saveTaskWithPlanning(input: SaveTaskWithPlanningInput): Promise<SaveTaskPlanningResult>;
  createTimedReminderTaskWithPlanning(input: CreateTimedReminderTaskWithPlanningInput): Promise<SaveTaskPlanningResult>;
  saveOccurrenceException(input: SaveOccurrenceExceptionInput): Promise<void>;
  moveRecurrenceOccurrence(input: MoveRecurrenceOccurrenceInput): Promise<{ scope: MoveRecurrenceOccurrenceInput['scope'] }>;
}

interface AppServicesContextValue {
  isReady: boolean;
  projects: ProjectRepository;
  settings: AppSettings;
  demoTasks: DemoTaskGroups;
  backlog: BacklogView;
  backlogActions: BacklogActions;
  planningActions: PlanningActions;
  refreshBacklog(): Promise<void>;
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
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const runStorageDiagnostic = useCallback(
    () => runPersistenceDiagnostic(appSource),
    [appSource],
  );
  const refreshBacklog = useCallback(async () => {
    const loadedBacklog = await getBacklogView(appSource);
    setBacklog(loadedBacklog);
  }, [appSource]);
  const runBacklogAction = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      const result = await action();
      await refreshBacklog();
      return result;
    },
    [refreshBacklog],
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
      updateProject: (input) =>
        runBacklogAction(() => updateProject(appSource, input)),
      updateTaskItem: (input) =>
        runBacklogAction(() => updateTaskItem(appSource, input)),
      updateReminder: (input) =>
        runBacklogAction(() => updateReminder(appSource, input)),
      moveTaskToProject: (input) =>
        runBacklogAction(() => moveTaskToProject(appSource, input)),
      completeItem: (input) =>
        runBacklogAction(() => completeBacklogItem(appSource, input)),
      deleteItem: (input) =>
        runBacklogAction(() => deleteBacklogItem(appSource, input)),
    }),
    [appSource, runBacklogAction],
  );
  const planningActions = useMemo<PlanningActions>(
    () => ({
      convertReminderToTask: (reminderId, taskId, createdAt) => convertReminderToTask(appSource, { reminderId, taskId, createdAt }),
      getPlanScheduleBlocks: (isoDate) => getPlanScheduleBlocks(appSource, isoDate),
      getTaskPlanningSnapshot: (taskId) => getTaskPlanningSnapshot(appSource, taskId),
      setRecurrenceOccurrenceState: (seriesId, occursOn, state) => setRecurrenceOccurrenceState(appSource, seriesId, occursOn, state),
      getPlanUntimedReminders: (isoDate) => getPlanUntimedReminders(appSource, isoDate),
      syncReminderRecurrence: (reminderId) => syncReminderRecurrence(appSource, reminderId),
      saveTaskPlanning: (input) => saveTaskPlanning(appSource, input),
      saveTaskWithPlanning: (input) => runBacklogAction(() => saveTaskWithPlanning(appSource, input)),
      createTimedReminderTaskWithPlanning: (input) => runBacklogAction(() => createTimedReminderTaskWithPlanning(appSource, input)),
      saveOccurrenceException: (input) => saveOccurrenceException(appSource, input),
      moveRecurrenceOccurrence: (input) => moveRecurrenceOccurrence(appSource, input),
    }),
    [appSource, runBacklogAction],
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

        if (isMounted) {
          setSettings(loadedSettings);
          setDemoTasks(loadedDemoTasks);
          setBacklog(loadedBacklog);
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
        demoTasks,
        backlog,
        backlogActions,
        planningActions,
        refreshBacklog,
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
