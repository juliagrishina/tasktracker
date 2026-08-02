import { getDemoTasks } from '../../src/ui/demo-tasks';

describe('browser demo tasks', () => {
  test('provides examples for Plan, Backlog and Completed', () => {
    const demoTasks = getDemoTasks('web');

    expect(demoTasks.plan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Подготовить черновик недели' }),
      ]),
    );
    expect(demoTasks.backlog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Разобрать входящие заметки' }),
      ]),
    );
    expect(demoTasks.completed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Заполнить итоги дня' }),
      ]),
    );
  });

  test('does not seed browser examples on a native platform', () => {
    const demoTasks = getDemoTasks('ios');

    expect(demoTasks.plan).toEqual([]);
    expect(demoTasks.backlog).toEqual([]);
    expect(demoTasks.completed).toEqual([]);
  });
});
