import {
  createDefaultBlock,
  createInitialTaskPlanningDraft,
  validateTaskPlanningDraft,
} from '../../src/ui/backlog/task-planning-fields';

describe('task planning fields', () => {
  test('moves an exact five-minute default start into the future', () => {
    expect(createDefaultBlock('2026-08-05', new Date('2026-08-05T10:00:00+03:00')))
      .toMatchObject({ date: '2026-08-05', startsAt: '10:05' });
  });

  test('carries a late default start into the following calendar day', () => {
    expect(createDefaultBlock('2026-08-05', new Date('2026-08-05T23:59:00+03:00')))
      .toMatchObject({ date: '2026-08-06', startsAt: '00:00' });
  });

  test('rejects a block duration outside the five-minute grid before saving', () => {
    expect(validateTaskPlanningDraft({
      ...createInitialTaskPlanningDraft(),
      blocks: [{
        id: 'one-minute-block',
        date: '2026-08-05',
        startsAt: '09:00',
        durationMinutes: '1',
      }],
    })).toContain('блок времени');
  });
});
