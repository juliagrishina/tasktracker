import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CompletedItemDetails } from '../../application/completed-use-cases';
import { designTokens } from '../design/tokens';

interface CompletedItemDetailsSheetProps {
  details: CompletedItemDetails;
  onRequestClose: () => void;
  timeZoneId: string;
  visible: boolean;
}

export function CompletedItemDetailsSheet({ details, onRequestClose, timeZoneId, visible }: CompletedItemDetailsSheetProps) {
  return (
    <Modal animationType="slide" onRequestClose={onRequestClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.sheet}>
          <Text style={styles.heading}>Детали завершённого дела</Text>
          <Text style={styles.title}>{details.item.title}</Text>
          <ScrollView contentContainerStyle={styles.details}>
            <DetailRow label="Тип" value={details.typeLabel} />
            {details.description === null ? null : <DetailRow label="Описание" value={details.description} />}
            {details.relation === null ? null : <DetailRow label={details.relation.label} value={details.relation.title} />}
            <DetailRow label="Завершено" value={formatCompletedAt(details.item.completedAt, timeZoneId)} />
            <DetailRow label="Контекст" value={details.completionContext} />
          </ScrollView>
          <Pressable accessibilityLabel="Закрыть детали завершённого дела" accessibilityRole="button" onPress={onRequestClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <Text style={styles.closeButtonText}>Закрыть</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

function formatCompletedAt(completedAt: string, timeZoneId: string) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: timeZoneId, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(completedAt));
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: designTokens.color.overlay.scrim, flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: designTokens.color.surface.raised, borderTopLeftRadius: designTokens.radius.sheet, borderTopRightRadius: designTokens.radius.sheet, maxHeight: '82%', padding: designTokens.space[20], ...designTokens.elevation.card },
  heading: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.sectionTitle, fontWeight: designTokens.typography.weight.bold, lineHeight: designTokens.typography.lineHeight.sectionTitle },
  title: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.body, lineHeight: designTokens.typography.lineHeight.body, marginTop: designTokens.space[4] },
  details: { gap: designTokens.space[10], paddingVertical: designTokens.space[16] },
  detailRow: { gap: designTokens.space[2] },
  label: { color: designTokens.color.text.tertiary, fontSize: designTokens.typography.size.meta, fontWeight: designTokens.typography.weight.semibold, lineHeight: designTokens.typography.lineHeight.meta },
  value: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.body, lineHeight: designTokens.typography.lineHeight.body },
  closeButton: { alignItems: 'center', backgroundColor: designTokens.color.primarySoft, borderRadius: designTokens.radius.control, justifyContent: 'center', minHeight: designTokens.size.touchTargetMin },
  closeButtonText: { color: designTokens.color.primaryStrong, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.bold, lineHeight: designTokens.typography.lineHeight.label },
  pressed: { opacity: designTokens.state.pressedOpacity },
});
