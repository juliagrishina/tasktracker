import { StyleSheet, Text } from 'react-native';

import { designTokens } from './design/tokens';
import { SurfaceCard } from './primitives/surface-card';

interface EmptyPlanStateProps {
  today: Date;
}

export function EmptyPlanState({ today }: EmptyPlanStateProps) {
  const localizedDate = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(today);

  return (
    <SurfaceCard style={styles.card} tone="info">
      <Text style={styles.eyebrow}>План на сегодня</Text>
      <Text style={styles.date}>{localizedDate}</Text>
      <Text style={styles.message}>На этот день пока ничего не запланировано.</Text>
      <Text style={styles.hint}>Первое дело появится в Backlog</Text>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    justifyContent: 'center',
    padding: designTokens.space[24],
  },
  eyebrow: {
    color: designTokens.color.primaryStrong,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
    fontWeight: designTokens.typography.weight.bold,
    textTransform: 'uppercase',
  },
  date: {
    marginTop: designTokens.space[8],
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.screenTitle,
    lineHeight: designTokens.typography.lineHeight.screenTitle,
    fontWeight: designTokens.typography.weight.bold,
    textTransform: 'capitalize',
  },
  message: {
    marginTop: designTokens.space[24],
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
  hint: {
    marginTop: designTokens.space[12],
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
    fontWeight: designTokens.typography.weight.semibold,
  },
});
