import {
  getPlanLoadTone,
  getWeekLoadDays,
  shiftPlanAnchor,
} from '../../src/ui/plan/plan-period-model';

describe('plan period load model', () => {
  test('maps all approved load thresholds without capping overload', () => {
    expect(getPlanLoadTone(0)).toBe('low');
    expect(getPlanLoadTone(50)).toBe('low');
    expect(getPlanLoadTone(51)).toBe('medium');
    expect(getPlanLoadTone(70)).toBe('medium');
    expect(getPlanLoadTone(71)).toBe('high');
    expect(getPlanLoadTone(104)).toBe('high');
  });

  test('builds a Monday-first seven-day week around its selected day', () => {
    expect(getWeekLoadDays('2026-08-05').map((day) => day.isoDate)).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
    ]);
    expect(shiftPlanAnchor('2026-08-05', 'week', 1)).toBe('2026-08-12');
  });

  test('uses the supplied real load values instead of presentation fixtures', () => {
    expect(getWeekLoadDays('2026-08-05', (isoDate) => isoDate === '2026-08-05' ? 125 : 0)[2]).toMatchObject({
      isoDate: '2026-08-05',
      loadPercent: 125,
      tone: 'high',
    });
  });

  test('rounds a period load percentage for display without changing its tone', () => {
    expect(getWeekLoadDays('2026-08-05', (isoDate) => isoDate === '2026-08-05' ? 14.285714285714285 : 0)[2]).toMatchObject({
      loadPercent: 14,
      tone: 'low',
    });
  });
});
