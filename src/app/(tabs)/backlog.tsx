import { Platform, StyleSheet, Text } from 'react-native';

import { getDemoTasks } from '../../ui/demo-tasks';
import { ScreenShell } from '../../ui/screen-shell';
import { TaskPreviewList } from '../../ui/task-preview-list';

export default function BacklogScreen() {
  const demoTasks = getDemoTasks(Platform.OS);

  return (
    <ScreenShell title="Backlog">
      {demoTasks.backlog.length === 0 ? (
        <Text style={styles.description}>
          Здесь появятся задачи, которые ещё не добавлены в план дня.
        </Text>
      ) : (
        <TaskPreviewList
          heading="Незапланированные задачи"
          supportingText="Демонстрационные задачи браузерного прототипа"
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
