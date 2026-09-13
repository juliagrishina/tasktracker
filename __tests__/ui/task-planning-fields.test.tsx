import { fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

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

test('derives the first block date from the task date while extra blocks retain their own date', async () => {
  function DateModeProbe() {
    const [draft, setDraft] = useState({
      ...createInitialTaskPlanningDraft('2026-08-30'),
      blocks: [{ id: 'block-1', date: '2026-08-30', startsAt: '09:00', durationMinutes: '60' }],
    });
    return <><TaskPlanningFields defaultBlock={{ id: 'suggestion', date: '2026-08-30', startsAt: '10:00', durationMinutes: '60' }} onChange={setDraft} value={draft} /><Text>{draft.blocks[0].date}</Text></>;
  }

  const view = await render(<DateModeProbe />);
  expect(view.queryByLabelText('Дата блока 1')).toBeNull();
  expect(view.getByText('На дату задачи: 30.08.2026')).toBeOnTheScreen();

  await fireEvent.press(view.getByLabelText('Дата задачи'));
  await fireEvent.press(view.getByLabelText('31 Август 2026'));
  expect(view.getByText('2026-08-31')).toBeOnTheScreen();

  await fireEvent.press(view.getByLabelText('Добавить блок времени'));
  expect(view.getByLabelText('Дата блока 2')).toBeOnTheScreen();
});
