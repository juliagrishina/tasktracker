import { Pressable, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

export type PlannedItemType = 'task' | 'subtask' | 'reminder';
export interface PlanningSuccessResult { plannedOn: string; title: string; type: PlannedItemType; }

function successCopy(type: PlannedItemType): string {
  return type === 'reminder' ? 'Напоминание успешно запланировано' : type === 'subtask' ? 'Подзадача успешно запланирована' : 'Задача успешно запланирована';
}
function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return year === undefined || month === undefined || day === undefined ? date : `${day}.${month}.${year}`;
}
export function PlanningSuccess({ result, onGoToPlan }: { result: PlanningSuccessResult; onGoToPlan: () => void }) {
  return <View accessibilityLabel="Успешное планирование" style={styles.card}><Text style={styles.check}>✓</Text><Text style={styles.title}>{successCopy(result.type)}</Text><Text style={styles.itemTitle}>{result.title}</Text><Text style={styles.question}>{`Перейти к дате ${formatDate(result.plannedOn)}?`}</Text><Pressable accessibilityLabel="Перейти к запланированной дате" onPress={onGoToPlan} style={styles.action}><Text style={styles.actionText}>Перейти</Text></Pressable></View>;
}
const styles = StyleSheet.create({
  card: { alignItems: 'center', backgroundColor: designTokens.color.surface.raised, borderRadius: designTokens.radius.sheet, gap: designTokens.space[12], padding: designTokens.space[24] },
  check: { color: designTokens.color.feedback.success.base, fontSize: 48, lineHeight: 56 },
  title: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.sectionTitle, fontWeight: designTokens.typography.weight.bold },
  itemTitle: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.body, textAlign: 'center' },
  question: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.body, marginTop: designTokens.space[8], textAlign: 'center' },
  action: { alignItems: 'center', backgroundColor: designTokens.color.primary, borderRadius: designTokens.radius.control, justifyContent: 'center', minHeight: designTokens.size.touchTargetMin, width: '100%' },
  actionText: { color: designTokens.color.text.inverse, fontSize: designTokens.typography.size.body, fontWeight: designTokens.typography.weight.bold },
});
