import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useAppServices } from '../../../../application/app-services-provider';
import { designTokens } from '../../../../ui/design/tokens';
import { ItemDetailActions } from '../../../../ui/backlog/item-detail-actions';
import { ItemFormSheet } from '../../../../ui/backlog/item-form-sheet';
import { TreeList } from '../../../../ui/backlog/tree-list';
import { ScreenShell } from '../../../../ui/screen-shell';
import { useState } from 'react';

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function ProjectRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const { backlog } = useAppServices();
  const [editing, setEditing] = useState(false);
  const projectEntry = backlog.projects.find((entry) => entry.project.id === firstValue(id));

  if (projectEntry === undefined) {
    return (
      <ScreenShell onBack={() => router.back()} title="Проект">
        <Text style={styles.empty}>Проект больше не находится в активном Backlog.</Text>
      </ScreenShell>
    );
  }

  const { project, tasks } = projectEntry;

  return (
    <ScreenShell onBack={() => router.back()} title={project.title}>
      {project.description === null ? null : <Text style={styles.description}>{project.description}</Text>}
      <TreeList
        emptyText="В проекте пока нет активных задач. Добавьте задачу из меню «+» в Backlog и выберите этот проект."
        onOpenItem={(taskId, kind) => router.push({ pathname: '/backlog/item/[id]', params: { id: taskId, kind } })}
        trees={tasks}
      />
      <ItemDetailActions
        id={project.id}
        kind="project"
        onCompleted={() => router.back()}
        onDeleted={() => router.back()}
        onEdit={() => setEditing(true)}
      />
      {editing ? (
        <ItemFormSheet
          item={project}
          mode="edit"
          onClose={() => setEditing(false)}
          type="project"
          visible
        />
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  description: {
    marginBottom: designTokens.space[16],
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
  empty: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
});
