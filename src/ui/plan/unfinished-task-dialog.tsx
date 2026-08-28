import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { designTokens } from '../design/tokens';

interface UnfinishedTaskDialogProps {
  error?: string | null;
  isActing: boolean;
  onContinue: () => void;
  onMove: () => void;
  onRequestClose: () => void;
  onReturnToBacklog: (reason: string | null) => void;
  taskTitle: string;
  visible: boolean;
}

export function UnfinishedTaskDialog({ error = null, isActing, onContinue, onMove, onRequestClose, onReturnToBacklog, taskTitle, visible }: UnfinishedTaskDialogProps) {
  const [reason, setReason] = useState('');
  return (
    <Modal animationType="fade" onRequestClose={onRequestClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text style={styles.title}>Что сделать с незавершённым делом?</Text>
          <Text style={styles.description}>«{taskTitle}» не завершено. Выберите следующее действие.</Text>
          {error === null ? null : <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          <Pressable accessibilityLabel="Продолжить дело на 30 минут" accessibilityRole="button" disabled={isActing} onPress={onContinue} style={({ pressed }) => [styles.action, styles.continueAction, pressed && styles.pressed, isActing && styles.disabled]}>
            <Text style={styles.continueActionText}>Продолжить на 30 минут</Text>
          </Pressable>
          <Pressable accessibilityLabel="Перенести дело на другое время" accessibilityRole="button" disabled={isActing} onPress={onMove} style={({ pressed }) => [styles.action, styles.moveAction, pressed && styles.pressed, isActing && styles.disabled]}>
            <Text style={styles.moveActionText}>Перенести</Text>
          </Pressable>
          <TextInput accessibilityLabel="Причина возврата в Backlog" editable={!isActing} onChangeText={setReason} placeholder="Причина возврата в Backlog (необязательно)" placeholderTextColor={designTokens.color.text.tertiary} style={styles.reason} value={reason} />
          <Pressable accessibilityLabel="Вернуть дело в Backlog" accessibilityRole="button" disabled={isActing} onPress={() => onReturnToBacklog(reason.trim() === '' ? null : reason.trim())} style={({ pressed }) => [styles.action, styles.backlogAction, pressed && styles.pressed, isActing && styles.disabled]}>
            <Text style={styles.backlogActionText}>Вернуть в Backlog</Text>
          </Pressable>
          <Pressable accessibilityLabel="Отмена действий с незавершённым делом" accessibilityRole="button" disabled={isActing} onPress={onRequestClose} style={({ pressed }) => [styles.cancelAction, pressed && styles.pressed, isActing && styles.disabled]}>
            <Text style={styles.cancelActionText}>Отмена</Text>
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
  continueAction: { backgroundColor: designTokens.color.feedback.success.base },
  continueActionText: { color: designTokens.color.text.inverse, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.bold },
  moveAction: { backgroundColor: designTokens.color.primarySoft },
  moveActionText: { color: designTokens.color.primaryStrong, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.bold },
  reason: { borderColor: designTokens.color.border.subtle, borderRadius: designTokens.radius.control, borderWidth: 1, color: designTokens.color.text.primary, fontSize: designTokens.typography.size.label, minHeight: designTokens.size.touchTargetMin, paddingHorizontal: designTokens.space[12] },
  backlogAction: { borderColor: designTokens.color.feedback.danger.foreground, borderWidth: 1 },
  backlogActionText: { color: designTokens.color.feedback.danger.foreground, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.bold },
  cancelAction: { alignItems: 'center', justifyContent: 'center', minHeight: designTokens.size.touchTargetMin },
  cancelActionText: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.semibold },
  pressed: { opacity: designTokens.state.pressedOpacity },
  disabled: { opacity: designTokens.state.disabledOpacity },
});
