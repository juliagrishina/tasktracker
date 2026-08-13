import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

export function confirmBacklogDeletion(): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm('Удалить этот элемент без возможности восстановления?'));
  }

  return new Promise((resolve) => {
    Alert.alert(
      'Удалить элемент?',
      'Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Удалить', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function ScheduleConflictConfirmation({
  conflictTitles,
  onCancel,
  onSave,
}: {
  conflictTitles: readonly string[];
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={styles.conflict}>
      <Text style={styles.conflictTitle}>Пересечение в расписании</Text>
      <Text style={styles.conflictDetail}>{conflictTitles.join('\n')}</Text>
      <View style={styles.conflictActions}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancelAction}>
          <Text style={styles.cancelText}>Отменить</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSave} style={styles.saveAction}>
          <Text style={styles.saveText}>Сохранить с пересечением</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ReminderTimeConfirmation({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={styles.conversion}>
      <Text style={styles.conversionTitle}>Преобразовать напоминание в задачу?</Text>
      <Text style={styles.conversionDetail}>
        Временной блок доступен только для задач. Дата, период, оценка и повтор сохранятся.
      </Text>
      <View style={styles.conflictActions}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancelAction}>
          <Text style={styles.cancelText}>Оставить напоминание</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onConfirm} style={styles.saveAction}>
          <Text style={styles.saveText}>Преобразовать</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conflict: {
    backgroundColor: designTokens.color.feedback.warning.surface,
    gap: designTokens.space[6],
    paddingHorizontal: designTokens.space[20],
    paddingVertical: designTokens.space[12],
  },
  conflictTitle: {
    color: designTokens.color.feedback.warning.foreground,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  conflictDetail: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  conversion: {
    backgroundColor: designTokens.color.surface.info,
    gap: designTokens.space[6],
    paddingHorizontal: designTokens.space[20],
    paddingVertical: designTokens.space[12],
  },
  conversionTitle: {
    color: designTokens.color.primaryStrong,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  conversionDetail: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  conflictActions: {
    flexDirection: 'row',
    gap: designTokens.space[8],
  },
  cancelAction: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
  },
  cancelText: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  saveAction: {
    alignItems: 'center',
    backgroundColor: designTokens.color.primary,
    borderRadius: designTokens.radius.control,
    flex: 2,
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
    paddingHorizontal: designTokens.space[10],
  },
  saveText: {
    color: designTokens.color.text.inverse,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
    textAlign: 'center',
  },
});
