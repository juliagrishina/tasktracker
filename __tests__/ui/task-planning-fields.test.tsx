import { fireEvent, render } from '@testing-library/react-native';

import { createInitialTaskPlanningDraft, TaskPlanningFields } from '../../src/ui/backlog/task-planning-fields';

test('opens the no-free-slot decision when a time block cannot be suggested', async () => {
  const onNoFreeSlot = jest.fn();
  const view = await render(<TaskPlanningFields defaultBlock={null} onChange={() => {}} onNoFreeSlot={onNoFreeSlot} value={createInitialTaskPlanningDraft('2026-08-30')} />);

  await fireEvent.press(view.getByLabelText('Добавить блок времени'));

  expect(onNoFreeSlot).toHaveBeenCalledTimes(1);
});

test('renders time blocks before recurrence controls', async () => {
  const view = await render(<TaskPlanningFields defaultBlock={{ id: 'block-1', date: '2026-08-30', startsAt: '09:00', durationMinutes: '60' }} onChange={() => {}} value={{ ...createInitialTaskPlanningDraft('2026-08-30'), blocks: [{ id: 'block-1', date: '2026-08-30', startsAt: '09:00', durationMinutes: '60' }] }} />);

  const tree = JSON.stringify(view.toJSON());
  expect(tree.indexOf('Временные блоки')).toBeLessThan(tree.indexOf('Повторение'));
});
