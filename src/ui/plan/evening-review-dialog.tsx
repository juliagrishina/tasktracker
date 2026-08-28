import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { EveningReviewItem } from '../../application/evening-review';
import { designTokens } from '../design/tokens';

interface EveningReviewDialogProps {
  items: readonly EveningReviewItem[];
  onRequestClose: () => void;
  visible: boolean;
}

export function EveningReviewDialog({ items, onRequestClose, visible }: EveningReviewDialogProps) {
  return (
    <Modal animationType="fade" onRequestClose={onRequestClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text style={styles.title}>Вечерняя проверка</Text>
          <Text style={styles.description}>Незавершённые дела на сегодня</Text>
          {items.length === 0 ? <Text style={styles.empty}>На сегодня незавершённых дел нет.</Text> : <View style={styles.items}>
            {items.map((item) => <View key={`${item.kind}-${item.id}-${item.occurrence?.occursOn ?? 'single'}`} style={styles.item}>
              <Text style={styles.itemKind}>{item.kind === 'task' ? 'Задача' : 'Напоминание'}</Text>
              <Text style={styles.itemTitle}>{item.title}</Text>
            </View>)}
          </View>}
          <Text style={styles.note}>Проверка не меняет состояние дел автоматически.</Text>
          <Pressable accessibilityLabel="Закрыть вечернюю проверку" accessibilityRole="button" onPress={onRequestClose} style={({ pressed }) => [styles.closeAction, pressed && styles.pressed]}>
            <Text style={styles.closeActionText}>Закрыть</Text>
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
  items: { gap: designTokens.space[6] },
  item: { backgroundColor: designTokens.color.surface.subtle, borderRadius: designTokens.radius.compact, gap: designTokens.space[2], padding: designTokens.space[10] },
  itemKind: { color: designTokens.color.text.tertiary, fontSize: designTokens.typography.size.micro, fontWeight: designTokens.typography.weight.semibold, lineHeight: designTokens.typography.lineHeight.micro },
  itemTitle: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.semibold, lineHeight: designTokens.typography.lineHeight.label },
  empty: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.label, lineHeight: designTokens.typography.lineHeight.label },
  note: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.meta, lineHeight: designTokens.typography.lineHeight.meta },
  closeAction: { alignItems: 'center', backgroundColor: designTokens.color.primarySoft, borderRadius: designTokens.radius.control, justifyContent: 'center', minHeight: designTokens.size.touchTargetMin },
  closeActionText: { color: designTokens.color.primaryStrong, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.bold, lineHeight: designTokens.typography.lineHeight.label },
  pressed: { opacity: designTokens.state.pressedOpacity },
});
