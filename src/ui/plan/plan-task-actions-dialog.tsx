import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

export type PlanTaskAction = 'complete' | 'resume' | 'returnToBacklog' | 'plan' | 'delete';

interface PlanTaskActionsDialogProps {
  onAction: (action: PlanTaskAction) => void;
  onDeletePermanently?: () => void;
  onDeleteSeries?: () => void;
  onRequestClose: () => void;
  isCompleted?: boolean;
  itemKind?: 'task' | 'reminder';
  taskTitle: string;
  visible: boolean;
}

export function PlanTaskActionsDialog({ isCompleted = false, itemKind = 'task', onAction, onDeletePermanently, onDeleteSeries, onRequestClose, taskTitle, visible }: PlanTaskActionsDialogProps) {
  const isReminder = itemKind === 'reminder';
  const noun = isReminder ? 'напоминанием' : 'задачей';
  const nominativeNoun = isReminder ? 'напоминание' : 'задачу';
  const returnToBacklogLabel = isReminder ? 'Вернуть напоминание в Backlog' : 'Вернуть задачу в Backlog';
  return <Modal animationType="fade" onRequestClose={onRequestClose} transparent visible={visible}><View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}>
    <Text style={styles.title}>Действия с {noun}</Text>
    <Text style={styles.description}>{taskTitle}</Text>
    {isCompleted ? <Pressable accessibilityLabel={`Возобновить ${nominativeNoun}`} accessibilityRole="button" onPress={() => onAction('resume')} style={[styles.action, styles.completeAction]}><Text style={styles.completeText}>Возобновить</Text></Pressable> : <Pressable accessibilityLabel={`Выполнить ${nominativeNoun}`} accessibilityRole="button" onPress={() => onAction('complete')} style={[styles.action, styles.completeAction]}><Text style={styles.completeText}>Выполнено</Text></Pressable>}
    <Pressable accessibilityLabel={returnToBacklogLabel} accessibilityRole="button" onPress={() => onAction('returnToBacklog')} style={[styles.action, styles.backlogAction]}><Text style={styles.backlogText}>Вернуть в Backlog</Text></Pressable>
    {isCompleted && !isReminder ? <Pressable accessibilityLabel="Запланировать задачу" accessibilityRole="button" onPress={() => onAction('plan')} style={[styles.action, styles.backlogAction]}><Text style={styles.backlogText}>Запланировать</Text></Pressable> : null}
    {!isCompleted || isReminder && onDeletePermanently === undefined ? <Pressable accessibilityLabel={`Удалить ${nominativeNoun}`} accessibilityRole="button" onPress={() => onAction('delete')} style={[styles.action, styles.deleteAction]}><Text style={styles.deleteText}>Удалить</Text></Pressable> : null}
    {onDeletePermanently === undefined ? null : <Pressable accessibilityLabel="Удалить из архива безвозвратно" accessibilityRole="button" onPress={onDeletePermanently} style={[styles.action, styles.deleteAction]}><Text style={styles.deleteText}>Удалить безвозвратно</Text></Pressable>}
    {onDeleteSeries === undefined ? null : <Pressable accessibilityLabel="Удалить всю серию" accessibilityRole="button" onPress={onDeleteSeries} style={[styles.action, styles.deleteAction]}><Text style={styles.deleteText}>Удалить всю серию</Text></Pressable>}
    <Pressable accessibilityLabel={`Закрыть действия с ${noun}`} accessibilityRole="button" onPress={onRequestClose} style={styles.cancel}><Text style={styles.cancelText}>Отмена</Text></Pressable>
  </View></View></Modal>;
}

interface DeletePlanTaskDialogProps {
  deletesSeries?: boolean;
  itemKind?: 'task' | 'reminder';
  onConfirm: () => void;
  onRequestClose: () => void;
  visible: boolean;
}

export function DeletePlanTaskDialog({ deletesSeries = false, itemKind = 'task', onConfirm, onRequestClose, visible }: DeletePlanTaskDialogProps) {
  const noun = itemKind === 'reminder' ? 'напоминание' : 'задачу';
  return <Modal animationType="fade" onRequestClose={onRequestClose} transparent visible={visible}><View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}>
    <Text style={styles.title}>{deletesSeries ? 'Удалить всю серию?' : `Удалить ${noun}?`}</Text>
    <Text style={styles.description}>{deletesSeries ? 'Вся серия повторения и все её экземпляры будут удалены.' : itemKind === 'reminder' ? 'Напоминание будет удалено.' : 'Задача и её планирование будут удалены.'}</Text>
    <Pressable accessibilityLabel={deletesSeries ? 'Подтвердить удаление всей серии' : `Подтвердить удаление ${noun}`} accessibilityRole="button" onPress={onConfirm} style={[styles.action, styles.deleteAction]}><Text style={styles.deleteText}>{deletesSeries ? 'Удалить всю серию' : 'Удалить'}</Text></Pressable>
    <Pressable accessibilityLabel={deletesSeries ? 'Отменить удаление всей серии' : `Отменить удаление ${noun}`} accessibilityRole="button" onPress={onRequestClose} style={styles.cancel}><Text style={styles.cancelText}>Отмена</Text></Pressable>
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
