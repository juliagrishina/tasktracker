import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAppServices } from '../../../application/app-services-provider';
import { designTokens } from '../../../ui/design/tokens';
import { SurfaceCard } from '../../../ui/primitives/surface-card';
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
            <SurfaceCard
              accessibilityLabel={reminder.title}
              key={reminder.id}
              onPress={() => router.push({ pathname: '/backlog/item/[id]', params: { id: reminder.id, kind: 'reminder' } })}
              style={styles.row}>
              <View style={styles.bell}><Text style={styles.bellText}>◌</Text></View>
              <View style={styles.textColumn}>
                <Text style={styles.title}>{reminder.title}</Text>
                {reminder.estimatedDurationMinutes === null ? null : <Text style={styles.detail}>≈ {reminder.estimatedDurationMinutes} мин.</Text>}
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
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', padding: designTokens.space[12] },
  bell: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designTokens.radius.control,
    marginRight: designTokens.space[10],
    backgroundColor: designTokens.color.feedback.warning.surface,
  },
  bellText: { color: designTokens.color.feedback.warning.foreground, fontSize: designTokens.typography.size.sectionTitle },
  textColumn: { flex: 1 },
  title: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
    fontWeight: designTokens.typography.weight.bold,
  },
  detail: {
    marginTop: designTokens.space[2],
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  chevron: { color: designTokens.color.text.tertiary, fontSize: designTokens.typography.size.sectionTitle },
  empty: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.body },
});
