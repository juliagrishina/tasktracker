import { emptyDemoTaskGroups } from '../../src/ui/demo-tasks';

describe('empty demo task groups', () => {
  test('keeps production fallback free of test cards', () => {
    expect(emptyDemoTaskGroups).toEqual({
      plan: [],
      backlog: [],
      completed: [],
    });
  });
});
