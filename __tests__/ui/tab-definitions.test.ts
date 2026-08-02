import { tabDefinitions } from '../../src/ui/tab-definitions';

describe('tab definitions', () => {
  test('keeps the approved tab order and labels', () => {
    expect(tabDefinitions).toEqual([
      { route: 'index', title: 'План' },
      { route: 'backlog', title: 'Backlog' },
      { route: 'completed', title: 'Завершённые' },
      { route: 'settings', title: 'Настройки' },
    ]);
  });
});
