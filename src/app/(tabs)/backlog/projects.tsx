import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppServices } from '../../../application/app-services-provider';
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
            <Pressable
              key={project.id}
              onPress={() => router.push({ pathname: '/backlog/project/[id]', params: { id: project.id } })}
              style={styles.row}>
              <View style={styles.textColumn}>
                <Text style={styles.title}>{project.title}</Text>
                <Text style={styles.detail}>{tasks.length === 0 ? 'Пока без задач' : `${tasks.length} ${tasks.length === 1 ? 'задача' : 'задач(и)'}`}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: { minHeight: 74, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: '#FFFFFF', paddingHorizontal: 17, shadowColor: '#101828', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  textColumn: { flex: 1 },
  title: { color: '#172033', fontSize: 17, fontWeight: '700' },
  detail: { marginTop: 5, color: '#667085', fontSize: 14 },
  chevron: { color: '#98A2B3', fontSize: 27 },
  empty: { color: '#667085', fontSize: 16, lineHeight: 23 },
});
