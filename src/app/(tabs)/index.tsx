import { useLocalSearchParams } from 'expo-router';
import { PlanScreen } from '../../ui/plan/plan-screen';

export default function PlanRoute() {
  const { date } = useLocalSearchParams<{ date?: string | string[] }>();
  const initialDate = Array.isArray(date) ? date[0] : date;

  return <PlanScreen initialDate={initialDate} />;
}
