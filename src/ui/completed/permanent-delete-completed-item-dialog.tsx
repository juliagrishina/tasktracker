import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

interface PermanentDeleteCompletedItemDialogProps {
  error: string | null;
  isDeleting: boolean;
  itemTitle: string;
  onConfirm: () => void;
  onRequestClose: () => void;
  scope?: 'item' | 'series';
  visible: boolean;
}

export function PermanentDeleteCompletedItemDialog({ error, isDeleting, itemTitle, onConfirm, onRequestClose, scope = 'item', visible }: PermanentDeleteCompletedItemDialogProps) {
  const deletesSeries = scope === 'series';
  return <Modal animationType="fade" onRequestClose={onRequestClose} transparent visible={visible}><View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}>
    <Text style={styles.title}>{deletesSeries ? 'Удалить всю серию?' : 'Удалить безвозвратно?'}</Text>
    <Text style={styles.description}>{deletesSeries ? `«${itemTitle}» и все экземпляры повторения будут удалены без возможности восстановления.` : `«${itemTitle}» исчезнет из архива без возможности восстановления.`}</Text>
    {error === null ? null : <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    <Pressable accessibilityLabel={deletesSeries ? 'Подтвердить удаление всей серии' : 'Подтвердить безвозвратное удаление'} accessibilityRole="button" disabled={isDeleting} onPress={onConfirm} style={[styles.action, styles.deleteAction, isDeleting && styles.disabled]}><Text style={styles.deleteText}>{isDeleting ? 'Удаляем…' : deletesSeries ? 'Удалить всю серию' : 'Удалить безвозвратно'}</Text></Pressable>
    <Pressable accessibilityLabel={deletesSeries ? 'Отменить удаление всей серии' : 'Отменить безвозвратное удаление'} accessibilityRole="button" disabled={isDeleting} onPress={onRequestClose} style={[styles.cancel, isDeleting && styles.disabled]}><Text style={styles.cancelText}>Отмена</Text></Pressable>
  </View></View></Modal>;
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: designTokens.color.overlay.scrim, flex: 1, justifyContent: 'center', padding: designTokens.space[20] },
  dialog: { backgroundColor: designTokens.color.surface.raised, borderRadius: designTokens.radius.sheet, gap: designTokens.space[10], maxWidth: 420, padding: designTokens.space[20], width: '100%', ...designTokens.elevation.card },
  title: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.sectionTitle, fontWeight: designTokens.typography.weight.bold, lineHeight: designTokens.typography.lineHeight.sectionTitle },
  description: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.body, lineHeight: designTokens.typography.lineHeight.body },
  error: { color: designTokens.color.feedback.danger.foreground, fontSize: designTokens.typography.size.label, lineHeight: designTokens.typography.lineHeight.label },
  action: { alignItems: 'center', borderRadius: designTokens.radius.control, justifyContent: 'center', minHeight: designTokens.size.touchTargetMin },
  deleteAction: { backgroundColor: designTokens.color.surface.subtle },
  deleteText: { color: designTokens.color.feedback.danger.foreground, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.bold },
  cancel: { alignItems: 'center', justifyContent: 'center', minHeight: designTokens.size.touchTargetMin },
  cancelText: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.semibold },
  disabled: { opacity: designTokens.state.disabledOpacity },
});
