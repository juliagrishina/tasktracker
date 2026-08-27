import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

interface CompletionDialogProps {
  error?: string | null;
  isCompleting: boolean;
  onComplete: () => void;
  onRequestClose: () => void;
  taskTitle: string;
  visible: boolean;
}

export function CompletionDialog({ error = null, isCompleting, onComplete, onRequestClose, taskTitle, visible }: CompletionDialogProps) {
  return (
    <Modal animationType="fade" onRequestClose={onRequestClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text style={styles.title}>Удалось закончить?</Text>
          <Text style={styles.description}>«{taskTitle}» завершено?</Text>
          {error === null ? null : <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          <Pressable
            accessibilityLabel="Да, завершить дело"
            accessibilityRole="button"
            disabled={isCompleting}
            onPress={onComplete}
            style={({ pressed }) => [styles.action, styles.completeAction, pressed && styles.pressed, isCompleting && styles.disabled]}>
            <Text style={styles.completeActionText}>{isCompleting ? 'Завершаем…' : 'Да, завершить'}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Отложить решение о завершении"
            accessibilityRole="button"
            disabled={isCompleting}
            onPress={onRequestClose}
            style={({ pressed }) => [styles.deferAction, pressed && styles.pressed, isCompleting && styles.disabled]}>
            <Text style={styles.deferActionText}>Не сейчас</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: designTokens.color.overlay.scrim,
    flex: 1,
    justifyContent: 'center',
    padding: designTokens.space[20],
  },
  dialog: {
    backgroundColor: designTokens.color.surface.raised,
    borderRadius: designTokens.radius.sheet,
    gap: designTokens.space[10],
    maxWidth: 420,
    padding: designTokens.space[20],
    width: '100%',
    ...designTokens.elevation.card,
  },
  title: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.sectionTitle,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.sectionTitle,
  },
  description: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
    marginBottom: designTokens.space[2],
  },
  error: {
    color: designTokens.color.feedback.danger.foreground,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  action: {
    alignItems: 'center',
    borderRadius: designTokens.radius.control,
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
  },
  completeAction: {
    backgroundColor: designTokens.color.feedback.success.base,
  },
  completeActionText: {
    color: designTokens.color.text.inverse,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  deferAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
  },
  deferActionText: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  pressed: { opacity: designTokens.state.pressedOpacity },
  disabled: { opacity: designTokens.state.disabledOpacity },
});
