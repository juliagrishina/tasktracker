import type { BacklogRepeatRule } from './entities';

export interface ReminderScheduleShape {
  remindsOn: string | null;
  periodStartOn: string | null;
  periodEndOn: string | null;
  repeatRule: BacklogRepeatRule | null;
}

export function assertBacklogTitle(title: string): void {
  if (title.trim().length === 0) {
    throw new Error('Название обязательно');
  }
}

export function assertEstimatedDuration(value: number | null): void {
  if (value === null) {
    return;
  }

  if (!Number.isInteger(value)) {
    throw new Error('Длительность должна быть целым числом минут');
  }

  if (value <= 0) {
    throw new Error('Длительность должна быть больше нуля');
  }
}

export function assertReminderScheduleShape(
  reminder: ReminderScheduleShape,
): void {
  const hasPeriodStart = reminder.periodStartOn !== null;
  const hasPeriodEnd = reminder.periodEndOn !== null;

  if (hasPeriodStart !== hasPeriodEnd) {
    throw new Error('Период напоминания должен иметь начало и конец');
  }

  if (
    reminder.periodStartOn !== null &&
    reminder.periodEndOn !== null &&
    reminder.periodStartOn > reminder.periodEndOn
  ) {
    throw new Error('Начало периода не может быть позже конца');
  }

  if (
    reminder.repeatRule !== null &&
    (!Number.isInteger(reminder.repeatRule.interval) ||
      reminder.repeatRule.interval <= 0)
  ) {
    throw new Error('Интервал повторения должен быть положительным целым числом');
  }
}
