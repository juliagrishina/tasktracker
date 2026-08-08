import { StyleSheet, Text, View } from 'react-native';

import type { DemoTask } from './demo-tasks';
import { designTokens } from './design/tokens';
import { SurfaceCard } from './primitives/surface-card';

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
          <SurfaceCard key={task.id} style={styles.card}>
            <Text style={styles.title}>{task.title}</Text>
            <Text style={styles.detail}>{task.detail}</Text>
          </SurfaceCard>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.sectionTitle,
    lineHeight: designTokens.typography.lineHeight.sectionTitle,
    fontWeight: designTokens.typography.weight.bold,
  },
  supportingText: {
    marginTop: designTokens.space[6],
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  list: {
    gap: designTokens.space[12],
    marginTop: designTokens.space[16],
  },
  card: {
    padding: designTokens.space[16],
  },
  title: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
    fontWeight: designTokens.typography.weight.semibold,
  },
  detail: {
    marginTop: designTokens.space[6],
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
  },
});
