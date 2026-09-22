import { formatDuration } from '../format-duration';
import type { PlanningValueOption } from './planning-value-picker';

export const blockDurationOptions: readonly PlanningValueOption[] = Array.from({ length: 288 }, (_, index) => {
  const minutes = (index + 1) * 5;
  return { label: formatDuration(minutes), value: String(minutes) };
});

export const estimatedDurationOptions: readonly PlanningValueOption[] = [
  { label: 'Без оценки', value: '' },
  ...blockDurationOptions,
];
