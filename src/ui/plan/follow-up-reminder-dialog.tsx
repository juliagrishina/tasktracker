import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PlanningDatePicker } from '../backlog/planning-date-picker';
import { designTokens } from '../design/tokens';

interface FollowUpReminderDialogProps {
  error?: string | null;
  isCreating: boolean;
  onCreate: (remindsOn: string) => void;
  onSkip: () => void;
  taskTitle: string;
  completedOn: string;
  visible: boolean;
}

export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function FollowUpReminderDialog({ error = null, isCreating, onCreate, onSkip, taskTitle, completedOn, visible }: FollowUpReminderDialogProps) {
  const [customDateVisible, setCustomDateVisible] = useState(false);
  const [customDate, setCustomDate] = useState(completedOn);
  const options = [3, 7, 14] as const;

  return (
    <Modal animationType="fade" onRequestClose={onSkip} transparent visible={visible}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text style={styles.title}>Создать связанное напоминание?</Text>
          <Text style={styles.description}>Вернуться к «{taskTitle}» через:</Text>
          {error === null ? null : <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          {options.map((days) => (
            <Pressable accessibilityLabel={`Напомнить через ${days} ${days === 3 ? 'дня' : 'дней'}`} accessibilityRole="button" disabled={isCreating} key={days} onPress={() => onCreate(addCalendarDays(completedOn, days))} style={({ pressed }) => [styles.action, styles.dateAction, pressed && styles.pressed, isCreating && styles.disabled]}>
              <Text style={styles.dateActionText}>Через {days} {days === 3 ? 'дня' : 'дней'}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityLabel="Выбрать свою дату напоминания" accessibilityRole="button" disabled={isCreating} onPress={() => setCustomDateVisible((current) => !current)} style={({ pressed }) => [styles.customAction, pressed && styles.pressed, isCreating && styles.disabled]}>
            <Text style={styles.customActionText}>Выбрать дату</Text>
          </Pressable>
          {customDateVisible ? <View style={styles.customDate}><PlanningDatePicker accessibilityLabel="Дата связанного напоминания" onChange={setCustomDate} value={customDate} /><Pressable accessibilityLabel="Создать напоминание на выбранную дату" accessibilityRole="button" disabled={isCreating} onPress={() => onCreate(customDate)} style={({ pressed }) => [styles.action, styles.dateAction, pressed && styles.pressed, isCreating && styles.disabled]}><Text style={styles.dateActionText}>Создать на выбранную дату</Text></Pressable></View> : null}
          <Pressable accessibilityLabel="Не создавать связанное напоминание" accessibilityRole="button" disabled={isCreating} onPress={onSkip} style={({ pressed }) => [styles.skipAction, pressed && styles.pressed, isCreating && styles.disabled]}>
            <Text style={styles.skipActionText}>Не создавать</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: designTokens.color.overlay.scrim, flex: 1, justifyContent: 'center', padding: designTokens.space[20] },
  dialog: { backgroundColor: designTokens.color.surface.raised, borderRadius: designTokens.radius.sheet, gap: designTokens.space[10], maxWidth: 420, padding: designTokens.space[20], width: '100%', ...designTokens.elevation.card },
  title: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.sectionTitle, fontWeight: designTokens.typography.weight.bold, lineHeight: designTokens.typography.lineHeight.sectionTitle },
  description: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.body, lineHeight: designTokens.typography.lineHeight.body },
  error: { color: designTokens.color.feedback.danger.foreground, fontSize: designTokens.typography.size.label, lineHeight: designTokens.typography.lineHeight.label },
  action: { alignItems: 'center', borderRadius: designTokens.radius.control, justifyContent: 'center', minHeight: designTokens.size.touchTargetMin },
  dateAction: { backgroundColor: designTokens.color.primarySoft },
  dateActionText: { color: designTokens.color.primaryStrong, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.bold },
  customAction: { alignItems: 'center', justifyContent: 'center', minHeight: designTokens.size.touchTargetMin },
  customActionText: { color: designTokens.color.primaryStrong, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.semibold },
  customDate: { gap: designTokens.space[8] },
  skipAction: { alignItems: 'center', justifyContent: 'center', minHeight: designTokens.size.touchTargetMin },
  skipActionText: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.semibold },
  pressed: { opacity: designTokens.state.pressedOpacity },
  disabled: { opacity: designTokens.state.disabledOpacity },
});
