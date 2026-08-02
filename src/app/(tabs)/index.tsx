import { Platform, StyleSheet, Text } from 'react-native';

import { useAppServices } from '../../application/app-services-provider';
import { EmptyPlanState } from '../../ui/empty-plan-state';
import { getDemoTasks } from '../../ui/demo-tasks';
import { ScreenShell } from '../../ui/screen-shell';
import { TaskPreviewList } from '../../ui/task-preview-list';

export default function PlanScreen() {
  const { isReady } = useAppServices();
  const demoTasks = getDemoTasks(Platform.OS);

  return (
    <ScreenShell title="План">
      {isReady ? (
        demoTasks.plan.length === 0 ? (
          <EmptyPlanState today={new Date()} />
        ) : (
          <TaskPreviewList
            heading="План на сегодня"
            supportingText="Демонстрационные задачи браузерного прототипа"
            tasks={demoTasks.plan}
          />
        )
      ) : (
        <Text style={styles.loading}>Загружаем план…</Text>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loading: {
    color: '#475467',
    fontSize: 16,
  },
});
