import { StyleSheet, Text } from 'react-native';

import { useAppServices } from '../../application/app-services-provider';
import { ScreenShell } from '../../ui/screen-shell';
import { TaskPreviewList } from '../../ui/task-preview-list';

export default function BacklogScreen() {
  const { demoTasks } = useAppServices();

  return (
    <ScreenShell title="Backlog">
      {demoTasks.backlog.length === 0 ? (
        <Text style={styles.description}>
          Здесь появятся задачи, которые ещё не добавлены в план дня.
        </Text>
      ) : (
        <TaskPreviewList
          heading="Незапланированные задачи"
          supportingText="Тестовые задачи development-версии"
          tasks={demoTasks.backlog}
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  description: {
    color: '#475467',
    fontSize: 17,
    lineHeight: 25,
  },
});
