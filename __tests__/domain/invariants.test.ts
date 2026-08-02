import type { Reminder, ScheduleBlock, TaskItem } from '../../src/domain/entities';
import {
  assertReminderShape,
  assertScheduleBlockShape,
  assertTaskItemParent,
  assertTaskItemShape,
} from '../../src/domain/invariants';

const createdAt = '2026-08-01T08:00:00.000Z';

const task: TaskItem = {
  id: 'task-1',
  kind: 'task',
  projectId: 'project-1',
  parentTaskId: null,
  title: 'Подготовить план',
  description: null,
  estimatedDurationMinutes: null,
  completedAt: null,
  createdAt,
};

const reminder: Reminder = {
  id: 'reminder-1',
  title: 'Позвонить в страховую',
  remindsOn: null,
  periodStartOn: null,
  periodEndOn: null,
  repeatRule: null,
  estimatedDurationMinutes: null,
  completedAt: null,
  createdAt,
};

const block: ScheduleBlock = {
  id: 'block-1',
  taskItemId: task.id,
  startsAt: '2026-08-01T09:00:00.000Z',
  endsAt: '2026-08-01T09:30:00.000Z',
  createdAt,
};

describe('domain invariants', () => {
  test('rejects a top-level task with a parent', () => {
    expect(() =>
      assertTaskItemShape(
        { ...task, parentTaskId: 'parent-1' } as unknown as TaskItem,
      ),
    ).toThrow('Задача верхнего уровня не может иметь родителя');
  });

  test('rejects a subtask without a parent', () => {
    const subtask: TaskItem = {
      ...task,
      id: 'subtask-1',
      kind: 'subtask',
      parentTaskId: task.id,
    };

    expect(() =>
      assertTaskItemShape(
        { ...subtask, parentTaskId: null } as unknown as TaskItem,
      ),
    ).toThrow('Подзадача должна ссылаться на задачу-родителя');
  });

  test('rejects a subtask whose parent is another subtask', () => {
    const parentSubtask: TaskItem = {
      ...task,
      id: 'subtask-parent',
      kind: 'subtask',
      parentTaskId: task.id,
    };
    const childSubtask: TaskItem = {
      ...parentSubtask,
      id: 'subtask-child',
      parentTaskId: parentSubtask.id,
    };

    expect(() => assertTaskItemParent(childSubtask, parentSubtask)).toThrow(
      'Родителем подзадачи может быть только задача',
    );
  });

  test('rejects a subtask with a missing parent', () => {
    const childSubtask: TaskItem = {
      ...task,
      id: 'subtask-child',
      kind: 'subtask',
      parentTaskId: 'missing-parent',
    };

    expect(() => assertTaskItemParent(childSubtask, null)).toThrow(
      'Задача-родитель подзадачи не найдена',
    );
  });

  test('rejects a subtask that points to itself', () => {
    const childSubtask: TaskItem = {
      ...task,
      id: 'subtask-self',
      kind: 'subtask',
      parentTaskId: 'subtask-self',
    };

    expect(() => assertTaskItemParent(childSubtask, task)).toThrow(
      'Подзадача не может быть собственным родителем',
    );
  });

  test('rejects an incomplete reminder period', () => {
    expect(() =>
      assertReminderShape({ ...reminder, periodStartOn: '2026-08-01' }),
    ).toThrow('Период напоминания должен иметь начало и конец');
  });

  test('rejects a schedule block outside the five-minute grid', () => {
    expect(() =>
      assertScheduleBlockShape(
        { ...block, startsAt: '2026-08-01T09:03:00.000Z' },
        task,
      ),
    ).toThrow('Время блока должно иметь шаг пять минут');
  });
});
