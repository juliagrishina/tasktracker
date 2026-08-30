import { StyleSheet, Text } from 'react-native';

import { useAppServices } from '../../application/app-services-provider';
import { useLocalSearchParams } from 'expo-router';
import { designTokens } from '../../ui/design/tokens';
import { PlanScreen } from '../../ui/plan/plan-screen';

export default function PlanRoute() {
  const { isReady } = useAppServices();
  const { date } = useLocalSearchParams<{ date?: string | string[] }>();
  const initialDate = Array.isArray(date) ? date[0] : date;

  return (
    isReady ? <PlanScreen initialDate={initialDate} /> : <Text style={styles.loading}>Загружаем план…</Text>
  );
}

const styles = StyleSheet.create({
  loading: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
});
