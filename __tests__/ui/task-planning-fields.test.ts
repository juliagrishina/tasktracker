import React, { useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import {
  createDefaultBlock,
  createInitialTaskPlanningDraft,
  createScheduleBlocksFromDraft,
  TaskPlanningFields,
  type TaskPlanningBlock,
  type TaskPlanningDraft,
  validateTaskPlanningDraft,
} from '../../src/ui/backlog/task-planning-fields';

const block: TaskPlanningBlock = {
  date: '2026-08-10',
  durationMinutes: '30',
  id: 'block-one',
  startsAt: '09:00',
};

function PlanningFieldsHarness({
  initialValue,
  onChange,
}: {
  initialValue: TaskPlanningDraft;
  onChange: (value: TaskPlanningDraft) => void;
}) {
  const [value, setValue] = useState(initialValue);

  return React.createElement(TaskPlanningFields, {
    defaultBlock: block,
    onChange: (nextValue) => {
      setValue(nextValue);
      onChange(nextValue);
    },
    value,
  });
}

describe('task planning fields', () => {
  test('chooses a task date from the calendar without a text field', async () => {
    const onChange = jest.fn();
    const view = await render(React.createElement(TaskPlanningFields, {
      defaultBlock: block,
      onChange,
      value: {
        ...createInitialTaskPlanningDraft(),
        scheduleMode: 'date',
        scheduledOn: '2026-08-10',
      },
    }));

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Дата задачи' }));
    });
    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: '15 августа 2026' }));
    });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ scheduledOn: '2026-08-15' }));
    expect(view.queryByPlaceholderText('ГГГГ-ММ-ДД')).toBeNull();
  });

  test('opens the calendar immediately when date planning is selected', async () => {
    const view = await render(React.createElement(PlanningFieldsHarness, {
      initialValue: createInitialTaskPlanningDraft(),
      onChange: jest.fn(),
    }));

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Дата' }));
    });

    expect(view.getByRole('button', { name: '10 августа 2026' })).toBeOnTheScreen();
  });

  test('chooses exact start and estimate from picker controls', async () => {
    const onChange = jest.fn();
    const view = await render(React.createElement(PlanningFieldsHarness, {
      initialValue: {
        ...createInitialTaskPlanningDraft(),
        blocks: [block],
      },
      onChange,
    }));

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Начало интервала 1' }));
    });
    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: '09:30' }));
    });
    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Длительность интервала 1' }));
    });
    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: '45 минут' }));
    });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      blocks: [expect.objectContaining({ startsAt: '09:30', durationMinutes: '45' })],
    }));
  });

  test('keeps a hydrated existing interval editable through picker controls', async () => {
    const onChange = jest.fn();
    const view = await render(React.createElement(PlanningFieldsHarness, {
      initialValue: {
        ...createInitialTaskPlanningDraft(),
        blocks: [{ ...block, date: '2026-08-20', durationMinutes: '60', startsAt: '14:10' }],
      },
      onChange,
    }));

    expect(view.getByText('20.08.2026')).toBeOnTheScreen();
    expect(view.getByText('14:10')).toBeOnTheScreen();
    expect(view.getByText('1 час')).toBeOnTheScreen();

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Дата интервала 1' }));
    });
    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: '21 августа 2026' }));
    });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      blocks: [expect.objectContaining({ date: '2026-08-21', startsAt: '14:10', durationMinutes: '60' })],
    }));
  });

  test('renders exact intervals inside planning without the old separate section title', async () => {
    const view = await render(React.createElement(TaskPlanningFields, {
      defaultBlock: block,
      onChange: jest.fn(),
      value: createInitialTaskPlanningDraft(),
    }));

    expect(view.getByText('Планирование')).toBeOnTheScreen();
    expect(view.queryByText('Временные блоки')).toBeNull();
    expect(view.getByRole('button', { name: 'Добавить временной интервал' })).toBeOnTheScreen();
  });

  test('moves an exact five-minute default start into the future', () => {
    expect(createDefaultBlock('2026-08-05', new Date('2026-08-05T10:00:00+03:00')))
      .toMatchObject({ date: '2026-08-05', startsAt: '10:05' });
  });

  test('carries a late default start into the following calendar day', () => {
    expect(createDefaultBlock('2026-08-05', new Date('2026-08-05T23:59:00+03:00')))
      .toMatchObject({ date: '2026-08-06', startsAt: '00:00' });
  });

  test('rejects an impossible task date before saving', () => {
    expect(validateTaskPlanningDraft({
      ...createInitialTaskPlanningDraft(),
      scheduleMode: 'date',
      scheduledOn: '2026-02-30',
    })).toBe('Укажите корректную дату задачи');
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
    })).toBe('Исправьте временной интервал 1: дата, начало и длительность должны быть корректными');
  });

  test('stores the current IANA time zone on newly constructed blocks', () => {
    const [createdBlock] = createScheduleBlocksFromDraft({
      ...createInitialTaskPlanningDraft(),
      blocks: [block],
    }, 'task-one', '2026-08-10T08:00:00.000Z');

    expect(createdBlock.timeZoneId).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
  });
});
