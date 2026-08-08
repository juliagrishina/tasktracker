import { StyleSheet, Text } from 'react-native';

import { useAppServices } from '../../application/app-services-provider';
import { designTokens } from '../../ui/design/tokens';
import { DayDashboard } from '../../ui/plan/day-dashboard';

export default function PlanScreen() {
  const { isReady } = useAppServices();

  return (
    isReady ? <DayDashboard /> : <Text style={styles.loading}>Загружаем план…</Text>
  );
}

const styles = StyleSheet.create({
  loading: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
});
