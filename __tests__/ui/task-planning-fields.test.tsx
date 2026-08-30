import { fireEvent, render } from '@testing-library/react-native';

import { createInitialTaskPlanningDraft, TaskPlanningFields } from '../../src/ui/backlog/task-planning-fields';

test('opens the no-free-slot decision when a time block cannot be suggested', async () => {
  const onNoFreeSlot = jest.fn();
  const view = await render(<TaskPlanningFields defaultBlock={null} onChange={() => {}} onNoFreeSlot={onNoFreeSlot} value={createInitialTaskPlanningDraft('2026-08-30')} />);

  fireEvent.press(view.getByLabelText('Добавить блок времени'));

  expect(onNoFreeSlot).toHaveBeenCalledTimes(1);
});
