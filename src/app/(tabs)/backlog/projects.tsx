import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAppServices } from '../../../application/app-services-provider';
import { designTokens } from '../../../ui/design/tokens';
import { SurfaceCard } from '../../../ui/primitives/surface-card';
import { ScreenShell } from '../../../ui/screen-shell';

export default function ProjectsRoute() {
  const router = useRouter();
  const { backlog } = useAppServices();

  return (
    <ScreenShell onBack={() => router.back()} title="Проекты">
      {backlog.projects.length === 0 ? (
        <Text style={styles.empty}>Создайте первый проект из меню «+» в Backlog.</Text>
      ) : (
        <View style={styles.list}>
          {backlog.projects.map(({ project, tasks }) => (
            <SurfaceCard
              accessibilityLabel={project.title}
              key={project.id}
              onPress={() => router.push({ pathname: '/backlog/project/[id]', params: { id: project.id } })}
              style={styles.row}>
              <View style={styles.textColumn}>
                <Text style={styles.title}>{project.title}</Text>
                <Text style={styles.detail}>{tasks.length === 0 ? 'Пока без задач' : `${tasks.length} ${tasks.length === 1 ? 'задача' : 'задач(и)'}`}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </SurfaceCard>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: designTokens.space[10] },
  row: { minHeight: 74, flexDirection: 'row', alignItems: 'center', padding: designTokens.space[12] },
  textColumn: { flex: 1 },
  title: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
    fontWeight: designTokens.typography.weight.bold,
  },
  detail: {
    marginTop: designTokens.space[4],
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  chevron: { color: designTokens.color.text.tertiary, fontSize: designTokens.typography.size.sectionTitle },
  empty: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
});
