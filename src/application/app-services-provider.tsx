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

import type { AppSettings } from '../domain/entities';
import type { AppDataSource } from '../data/contracts';
import { createDataSource } from '../data/data-source';
import { getDefaultSettings } from '../data/default-settings';
import { ProjectRepository } from '../data/repositories/project-repository';
import {
  emptyDemoTaskGroups,
  type DemoTaskGroups,
} from '../ui/demo-tasks';

import { createAppRepositories } from './app-services';
import { loadDemoTaskGroups, seedDemoData } from './demo-data';
import { runPersistenceDiagnostic } from './persistence-diagnostic';

interface AppServicesContextValue {
  isReady: boolean;
  projects: ProjectRepository;
  settings: AppSettings;
  demoTasks: DemoTaskGroups;
  runStorageDiagnostic(): Promise<'created' | 'persisted'>;
}

interface AppServicesProviderProps {
  children: ReactNode;
  source?: AppDataSource;
  seedDevelopmentData?: boolean;
}

const AppServicesContext = createContext<AppServicesContextValue | null>(null);

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
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const runStorageDiagnostic = useCallback(
    () => runPersistenceDiagnostic(appSource),
    [appSource],
  );

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

        if (isMounted) {
          setSettings(loadedSettings);
          setDemoTasks(loadedDemoTasks);
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
