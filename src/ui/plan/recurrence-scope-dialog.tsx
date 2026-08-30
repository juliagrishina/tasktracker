import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

interface RecurrenceScopeDialogProps {
  actionLabel: string;
  onChoose: (scope: 'occurrence' | 'series') => Promise<void>;
  onRequestClose: () => void;
  seriesOptionLabel?: string;
  visible: boolean;
}

export function RecurrenceScopeDialog({ actionLabel, onChoose, onRequestClose, seriesOptionLabel = 'Всю серию', visible }: RecurrenceScopeDialogProps) {
  const occurrenceAccessibilityLabel = actionLabel === 'Редактировать повторение' ? 'Редактировать только выбранный экземпляр' : `${actionLabel}: только этот экземпляр`;
  const seriesAccessibilityLabel = actionLabel === 'Редактировать повторение'
    ? (seriesOptionLabel === 'Серию с этой даты' ? 'Редактировать серию с этой даты' : 'Редактировать всю серию')
    : `${actionLabel}: ${seriesOptionLabel.toLowerCase()}`;
  return <Modal animationType="fade" onRequestClose={onRequestClose} transparent visible={visible}><View style={styles.overlay}><View style={styles.dialog}><Text style={styles.title}>{actionLabel}</Text><Text style={styles.description}>К чему применить это изменение?</Text><Pressable accessibilityLabel={occurrenceAccessibilityLabel} onPress={() => void onChoose('occurrence')} style={[styles.action, styles.primary]}><Text style={styles.primaryText}>Только этот экземпляр</Text></Pressable><Pressable accessibilityLabel={seriesAccessibilityLabel} onPress={() => void onChoose('series')} style={[styles.action, styles.secondary]}><Text style={styles.secondaryText}>{seriesOptionLabel}</Text></Pressable><Pressable onPress={onRequestClose} style={styles.cancel}><Text style={styles.cancelText}>Отмена</Text></Pressable></View></View></Modal>;
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: designTokens.color.overlay.scrim, flex: 1, justifyContent: 'center', padding: designTokens.space[20] },
  dialog: { backgroundColor: designTokens.color.surface.base, borderRadius: designTokens.radius.sheet, gap: designTokens.space[10], maxWidth: 420, padding: designTokens.space[20], width: '100%' },
  title: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.sectionTitle, fontWeight: designTokens.typography.weight.bold },
  description: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.body },
  action: { alignItems: 'center', borderRadius: designTokens.radius.control, justifyContent: 'center', minHeight: designTokens.size.touchTargetMin },
  primary: { backgroundColor: designTokens.color.primary },
  secondary: { backgroundColor: designTokens.color.primarySoft },
  primaryText: { color: designTokens.color.text.inverse, fontWeight: designTokens.typography.weight.bold },
  secondaryText: { color: designTokens.color.primaryStrong, fontWeight: designTokens.typography.weight.bold },
  cancel: { alignItems: 'center', justifyContent: 'center', minHeight: designTokens.size.touchTargetMin },
  cancelText: { color: designTokens.color.text.secondary, fontWeight: designTokens.typography.weight.semibold },
});
