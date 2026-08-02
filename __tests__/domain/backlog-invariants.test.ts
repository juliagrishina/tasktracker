import {
  assertBacklogTitle,
  assertEstimatedDuration,
  assertReminderScheduleShape,
} from '../../src/domain/backlog-invariants';

describe('backlog invariants', () => {
  test('rejects a blank title', () => {
    expect(() => assertBacklogTitle('   ')).toThrow('Название обязательно');
  });

  test('rejects a non-positive or fractional duration', () => {
    expect(() => assertEstimatedDuration(0)).toThrow(
      'Длительность должна быть больше нуля',
    );
    expect(() => assertEstimatedDuration(15.5)).toThrow(
      'Длительность должна быть целым числом минут',
    );
  });

  test('requires a complete ordered reminder period', () => {
    expect(() =>
      assertReminderScheduleShape({
        remindsOn: null,
        periodStartOn: '2026-08-10',
        periodEndOn: null,
        repeatRule: null,
      }),
    ).toThrow('Период напоминания должен иметь начало и конец');

    expect(() =>
      assertReminderScheduleShape({
        remindsOn: null,
        periodStartOn: '2026-08-11',
        periodEndOn: '2026-08-10',
        repeatRule: null,
      }),
    ).toThrow('Начало периода не может быть позже конца');
  });

  test('accepts an optional date, period and repetition rule', () => {
    expect(() =>
      assertReminderScheduleShape({
        remindsOn: '2026-08-10',
        periodStartOn: '2026-08-11',
        periodEndOn: '2026-08-15',
        repeatRule: { frequency: 'weekly', interval: 2 },
      }),
    ).not.toThrow();
  });
});
