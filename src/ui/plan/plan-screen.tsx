import { useState } from 'react';

import { DayDashboard } from './day-dashboard';
import type { PlanViewMode } from './plan-period-model';
import { PlanViewMenu } from './plan-view-menu';

export function PlanScreen() {
  const [mode, setMode] = useState<PlanViewMode>('day');
  const [isModeMenuVisible, setIsModeMenuVisible] = useState(false);

  return (
    <>
      <DayDashboard mode={mode} onSelectMode={() => setIsModeMenuVisible(true)} />
      <PlanViewMenu
        mode={mode}
        onRequestClose={() => setIsModeMenuVisible(false)}
        onSelectMode={setMode}
        visible={isModeMenuVisible}
      />
    </>
  );
}
