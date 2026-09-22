import { getPlanningSuccessResultFromParams } from '../../src/ui/backlog/planning-success';

test('restores a planning success result from route parameters without reading Backlog', () => {
  expect(getPlanningSuccessResultFromParams({
    plannedOn: ['2026-09-22'],
    title: ['Личная задача'],
    type: ['task'],
  })).toEqual({
    plannedOn: '2026-09-22',
    title: 'Личная задача',
    type: 'task',
  });
});
