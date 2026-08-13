import React, { useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PlanningDatePicker } from '../../src/ui/backlog/planning-date-picker';
import { PlanningValuePicker } from '../../src/ui/backlog/planning-value-picker';
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

function getRelativeLuminance(hexColor: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hexColor.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function getContrastRatio(firstColor: string, secondColor: string): number {
  const first = getRelativeLuminance(firstColor);
  const second = getRelativeLuminance(secondColor);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
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

  test('chooses exact start and end from picker controls and stores the derived duration', async () => {
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
      fireEvent.press(view.getByRole('button', { name: 'Конец интервала 1' }));
    });
    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: '10:15' }));
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
    expect(view.getByText('15:10')).toBeOnTheScreen();

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

  test('defaults a new interval to the selected task date', async () => {
    const onChange = jest.fn();
    const view = await render(React.createElement(PlanningFieldsHarness, {
      initialValue: {
        ...createInitialTaskPlanningDraft(),
        scheduleMode: 'date',
        scheduledOn: '2026-08-20',
      },
      onChange,
    }));

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Добавить временной интервал' }));
    });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      blocks: [expect.objectContaining({ date: '2026-08-20' })],
    }));
  });

  test('defaults a new interval to the selected period start', async () => {
    const onChange = jest.fn();
    const view = await render(React.createElement(PlanningFieldsHarness, {
      initialValue: {
        ...createInitialTaskPlanningDraft(),
        periodEndOn: '2026-08-25',
        periodStartOn: '2026-08-22',
        scheduleMode: 'period',
      },
      onChange,
    }));

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Добавить временной интервал' }));
    });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      blocks: [expect.objectContaining({ date: '2026-08-22' })],
    }));
  });

  test('moves the period end forward when a later start is selected', async () => {
    const onChange = jest.fn();
    const view = await render(React.createElement(PlanningFieldsHarness, {
      initialValue: {
        ...createInitialTaskPlanningDraft(),
        periodEndOn: '2026-08-10',
        periodStartOn: '2026-08-10',
        scheduleMode: 'period',
      },
      onChange,
    }));

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Начало периода задачи' }));
    });
    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: '15 августа 2026' }));
    });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      periodEndOn: '2026-08-15',
      periodStartOn: '2026-08-15',
    }));
  });

  test('virtualizes picker options and opens near the selected value', async () => {
    const options = Array.from({ length: 288 }, (_, index) => {
      const hours = Math.floor(index / 12);
      const minutes = (index % 12) * 5;
      const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      return { label: value, value };
    });
    const view = await render(React.createElement(PlanningValuePicker, {
      accessibilityLabel: 'Начало тестового интервала',
      onChange: jest.fn(),
      options,
      title: 'Выберите время начала',
      value: '09:00',
    }));

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Начало тестового интервала' }));
    });

    expect(view.getByRole('button', { name: '09:00' })).toBeOnTheScreen();
    expect(view.getAllByRole('button').length).toBeLessThan(50);
  });

  test('uses selected-day colors with at least 4.5 to 1 contrast', async () => {
    const view = await render(React.createElement(PlanningDatePicker, {
      accessibilityLabel: 'Контрастная дата',
      onChange: jest.fn(),
      value: '2026-08-15',
      visible: true,
    }));
    const selectedDay = view.getByRole('button', { name: '15 августа 2026' });
    const selectedDayText = view.getByText('15');
    const backgroundColor = StyleSheet.flatten(selectedDay.props.style).backgroundColor as string;
    const foregroundColor = StyleSheet.flatten(selectedDayText.props.style).color as string;

    expect(getContrastRatio(backgroundColor, foregroundColor)).toBeGreaterThanOrEqual(4.5);
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
