import { StyleSheet, Text, View } from 'react-native';

import type { DemoTask } from './demo-tasks';

interface TaskPreviewListProps {
  heading: string;
  supportingText?: string;
  tasks: readonly DemoTask[];
}

export function TaskPreviewList({
  heading,
  supportingText,
  tasks,
}: TaskPreviewListProps) {
  return (
    <View>
      <Text style={styles.heading}>{heading}</Text>
      {supportingText === undefined ? null : (
        <Text style={styles.supportingText}>{supportingText}</Text>
      )}
      <View style={styles.list}>
        {tasks.map((task) => (
          <View key={task.id} style={styles.card}>
            <Text style={styles.title}>{task.title}</Text>
            <Text style={styles.detail}>{task.detail}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: '#172033',
    fontSize: 20,
    fontWeight: '700',
  },
  supportingText: {
    marginTop: 6,
    color: '#667085',
    fontSize: 15,
  },
  list: {
    gap: 12,
    marginTop: 16,
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    shadowColor: '#172033',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 1,
  },
  title: {
    color: '#172033',
    fontSize: 17,
    fontWeight: '600',
  },
  detail: {
    marginTop: 6,
    color: '#667085',
    fontSize: 14,
  },
});
