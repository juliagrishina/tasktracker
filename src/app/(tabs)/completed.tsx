import { Platform, StyleSheet, Text } from 'react-native';

import { getDemoTasks } from '../../ui/demo-tasks';
import { ScreenShell } from '../../ui/screen-shell';
import { TaskPreviewList } from '../../ui/task-preview-list';

export default function CompletedScreen() {
  const demoTasks = getDemoTasks(Platform.OS);

  return (
    <ScreenShell title="Завершённые">
      {demoTasks.completed.length === 0 ? (
        <Text style={styles.description}>
          Завершённые задачи появятся здесь после реализации соответствующего эпика.
        </Text>
      ) : (
        <TaskPreviewList
          heading="Готово"
          supportingText="Демонстрационные задачи браузерного прототипа"
          tasks={demoTasks.completed}
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
