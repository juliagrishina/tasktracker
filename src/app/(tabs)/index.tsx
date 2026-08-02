import { StyleSheet, Text } from 'react-native';

import { useAppServices } from '../../application/app-services-provider';
import { EmptyPlanState } from '../../ui/empty-plan-state';
import { ScreenShell } from '../../ui/screen-shell';
import { TaskPreviewList } from '../../ui/task-preview-list';

export default function PlanScreen() {
  const { demoTasks, isReady } = useAppServices();

  return (
    <ScreenShell title="План">
      {isReady ? (
        demoTasks.plan.length === 0 ? (
          <EmptyPlanState today={new Date()} />
        ) : (
          <TaskPreviewList
            heading="План на сегодня"
            supportingText="Тестовые задачи development-версии"
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
