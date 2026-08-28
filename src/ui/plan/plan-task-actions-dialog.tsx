import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

export type PlanTaskAction = 'complete' | 'resume' | 'returnToBacklog' | 'plan' | 'delete';

interface PlanTaskActionsDialogProps {
  onAction: (action: PlanTaskAction) => void;
  onRequestClose: () => void;
  isCompleted?: boolean;
  taskTitle: string;
  visible: boolean;
}

export function PlanTaskActionsDialog({ isCompleted = false, onAction, onRequestClose, taskTitle, visible }: PlanTaskActionsDialogProps) {
  return <Modal animationType="fade" onRequestClose={onRequestClose} transparent visible={visible}><View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}>
    <Text style={styles.title}>Действия с задачей</Text>
    <Text style={styles.description}>{taskTitle}</Text>
    {isCompleted ? <Pressable accessibilityLabel="Возобновить задачу" accessibilityRole="button" onPress={() => onAction('resume')} style={[styles.action, styles.completeAction]}><Text style={styles.completeText}>Возобновить</Text></Pressable> : <Pressable accessibilityLabel="Выполнить задачу" accessibilityRole="button" onPress={() => onAction('complete')} style={[styles.action, styles.completeAction]}><Text style={styles.completeText}>Выполнено</Text></Pressable>}
    <Pressable accessibilityLabel="Вернуть задачу в Backlog" accessibilityRole="button" onPress={() => onAction('returnToBacklog')} style={[styles.action, styles.backlogAction]}><Text style={styles.backlogText}>Вернуть в Backlog</Text></Pressable>
    {isCompleted ? <Pressable accessibilityLabel="Запланировать задачу" accessibilityRole="button" onPress={() => onAction('plan')} style={[styles.action, styles.backlogAction]}><Text style={styles.backlogText}>Запланировать</Text></Pressable> : <Pressable accessibilityLabel="Удалить задачу" accessibilityRole="button" onPress={() => onAction('delete')} style={[styles.action, styles.deleteAction]}><Text style={styles.deleteText}>Удалить</Text></Pressable>}
    <Pressable accessibilityLabel="Закрыть действия с задачей" accessibilityRole="button" onPress={onRequestClose} style={styles.cancel}><Text style={styles.cancelText}>Отмена</Text></Pressable>
  </View></View></Modal>;
}

interface DeletePlanTaskDialogProps {
  onConfirm: () => void;
  onRequestClose: () => void;
  visible: boolean;
}

export function DeletePlanTaskDialog({ onConfirm, onRequestClose, visible }: DeletePlanTaskDialogProps) {
  return <Modal animationType="fade" onRequestClose={onRequestClose} transparent visible={visible}><View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}>
    <Text style={styles.title}>Удалить задачу?</Text>
    <Text style={styles.description}>Задача и её планирование будут удалены.</Text>
    <Pressable accessibilityLabel="Подтвердить удаление задачи" accessibilityRole="button" onPress={onConfirm} style={[styles.action, styles.deleteAction]}><Text style={styles.deleteText}>Удалить</Text></Pressable>
    <Pressable accessibilityLabel="Отменить удаление задачи" accessibilityRole="button" onPress={onRequestClose} style={styles.cancel}><Text style={styles.cancelText}>Отмена</Text></Pressable>
  </View></View></Modal>;
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: designTokens.color.overlay.scrim, flex: 1, justifyContent: 'center', padding: designTokens.space[20] },
  dialog: { backgroundColor: designTokens.color.surface.raised, borderRadius: designTokens.radius.sheet, gap: designTokens.space[10], maxWidth: 420, padding: designTokens.space[20], width: '100%', ...designTokens.elevation.card },
  title: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.sectionTitle, fontWeight: designTokens.typography.weight.bold, lineHeight: designTokens.typography.lineHeight.sectionTitle },
  description: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.body, lineHeight: designTokens.typography.lineHeight.body },
  action: { alignItems: 'center', borderRadius: designTokens.radius.control, justifyContent: 'center', minHeight: designTokens.size.touchTargetMin },
  completeAction: { backgroundColor: designTokens.color.feedback.success.base },
  completeText: { color: designTokens.color.text.inverse, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.bold },
  backlogAction: { backgroundColor: designTokens.color.primarySoft },
  backlogText: { color: designTokens.color.primaryStrong, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.bold },
  deleteAction: { backgroundColor: designTokens.color.surface.subtle },
  deleteText: { color: designTokens.color.feedback.danger.foreground, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.bold },
  cancel: { alignItems: 'center', justifyContent: 'center', minHeight: designTokens.size.touchTargetMin },
  cancelText: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.semibold },
});
