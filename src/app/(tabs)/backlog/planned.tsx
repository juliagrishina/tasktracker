import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'react-native';

import { PlanningSuccess, getPlanningSuccessResultFromParams } from '../../../ui/backlog/planning-success';
import { ScreenShell } from '../../../ui/screen-shell';

export default function PlannedRoute() {
  const router = useRouter();
  const result = getPlanningSuccessResultFromParams(useLocalSearchParams());

  if (result === null) {
    return <ScreenShell onBack={() => router.back()} title="Готово"><Text>Не удалось открыть результат планирования.</Text></ScreenShell>;
  }

  return <ScreenShell onBack={() => router.back()} title="Готово"><PlanningSuccess onGoToPlan={() => router.replace({ pathname: '/', params: { date: result.plannedOn } })} result={result} /></ScreenShell>;
}
