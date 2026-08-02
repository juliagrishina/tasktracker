import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppServices } from '../../../application/app-services-provider';
import { ScreenShell } from '../../../ui/screen-shell';

export default function RemindersRoute() {
  const router = useRouter();
  const { backlog } = useAppServices();

  return (
    <ScreenShell onBack={() => router.back()} title="Напоминания">
      {backlog.reminders.length === 0 ? (
        <Text style={styles.empty}>Напоминаний без даты пока нет.</Text>
      ) : (
        <View style={styles.list}>
          {backlog.reminders.map((reminder) => (
            <Pressable
              key={reminder.id}
              onPress={() => router.push({ pathname: '/backlog/item/[id]', params: { id: reminder.id, kind: 'reminder' } })}
              style={styles.row}>
              <View style={styles.bell}><Text style={styles.bellText}>◌</Text></View>
              <View style={styles.textColumn}>
                <Text style={styles.title}>{reminder.title}</Text>
                {reminder.estimatedDurationMinutes === null ? null : <Text style={styles.detail}>≈ {reminder.estimatedDurationMinutes} мин.</Text>}
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
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: '#FFFFFF', paddingHorizontal: 16, shadowColor: '#101828', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  bell: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, marginRight: 12, backgroundColor: '#EEF2FF' },
  bellText: { color: '#4F46E5', fontSize: 21 },
  textColumn: { flex: 1 },
  title: { color: '#172033', fontSize: 16, fontWeight: '700' },
  detail: { marginTop: 3, color: '#667085', fontSize: 13 },
  chevron: { color: '#98A2B3', fontSize: 25 },
  empty: { color: '#667085', fontSize: 16 },
});
