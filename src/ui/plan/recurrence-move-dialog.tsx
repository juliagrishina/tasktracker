import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';
import { PlanningDatePicker } from '../backlog/planning-date-picker';

interface RecurrenceMoveDialogProps {
  occursOn: string;
  onMove: (targetDate: string, scope: 'occurrence' | 'series') => Promise<void>;
  onRequestClose: () => void;
  visible: boolean;
}

export function RecurrenceMoveDialog({ occursOn, onMove, onRequestClose, visible }: RecurrenceMoveDialogProps) {
  const [targetDate, setTargetDate] = useState(occursOn);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    if (visible) setTargetDate(occursOn);
  }, [occursOn, visible]);

  const move = async (scope: 'occurrence' | 'series') => {
    setIsMoving(true);
    try {
      await onMove(targetDate, scope);
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Modal animationType="fade" onRequestClose={onRequestClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>Перенести повторение</Text>
          <Text style={styles.description}>Выберите дату и область переноса.</Text>
          <View style={styles.dateField}>
            <Text style={styles.label}>Новая дата</Text>
            <PlanningDatePicker accessibilityLabel="Дата переноса" onChange={setTargetDate} value={targetDate} />
          </View>
          <Pressable accessibilityState={{ disabled: isMoving }} onPress={() => move('occurrence')} style={[styles.action, styles.primaryAction, isMoving && styles.disabledAction]}>
            <Text style={styles.primaryActionText}>Только этот экземпляр</Text>
          </Pressable>
          <Pressable accessibilityState={{ disabled: isMoving }} onPress={() => move('series')} style={[styles.action, styles.secondaryAction, isMoving && styles.disabledAction]}>
            <Text style={styles.secondaryActionText}>Всю серию</Text>
          </Pressable>
          <Pressable accessibilityState={{ disabled: isMoving }} onPress={onRequestClose} style={styles.cancelAction}>
            <Text style={styles.cancelActionText}>Отмена</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: designTokens.color.overlay.scrim, flex: 1, justifyContent: 'center', padding: designTokens.space[20] },
  dialog: { backgroundColor: designTokens.color.surface.base, borderRadius: designTokens.radius.sheet, gap: designTokens.space[10], maxWidth: 420, padding: designTokens.space[20], width: '100%' },
  title: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.sectionTitle, fontWeight: designTokens.typography.weight.bold, lineHeight: designTokens.typography.lineHeight.sectionTitle },
  description: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.body, lineHeight: designTokens.typography.lineHeight.body },
  dateField: { marginBottom: designTokens.space[6] },
  label: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.semibold, lineHeight: designTokens.typography.lineHeight.label, marginBottom: designTokens.space[6] },
  action: { alignItems: 'center', borderRadius: designTokens.radius.control, justifyContent: 'center', minHeight: designTokens.size.touchTargetMin, paddingHorizontal: designTokens.space[12] },
  primaryAction: { backgroundColor: designTokens.color.primary },
  secondaryAction: { backgroundColor: designTokens.color.primarySoft },
  primaryActionText: { color: designTokens.color.text.inverse, fontWeight: designTokens.typography.weight.bold },
  secondaryActionText: { color: designTokens.color.primaryStrong, fontWeight: designTokens.typography.weight.bold },
  cancelAction: { alignItems: 'center', minHeight: designTokens.size.touchTargetMin, justifyContent: 'center' },
  cancelActionText: { color: designTokens.color.text.secondary, fontWeight: designTokens.typography.weight.semibold },
  disabledAction: { opacity: designTokens.state.pressedOpacity },
});
