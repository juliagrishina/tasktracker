import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { FollowUpReminderDialog } from '../../src/ui/plan/follow-up-reminder-dialog';

describe('FollowUpReminderDialog', () => {
  test.each([
    ['Напомнить через 3 дня', '2026-08-31'],
    ['Напомнить через 7 дней', '2026-09-04'],
    ['Напомнить через 14 дней', '2026-09-11'],
  ])('uses %s to create a reminder for %s', async (label, expectedDate) => {
    const onCreate = jest.fn();
    const view = await render(<FollowUpReminderDialog completedOn="2026-08-28" isCreating={false} onCreate={onCreate} onSkip={jest.fn()} taskTitle="Подготовить отчёт" visible />);

    fireEvent.press(view.getByLabelText(label));

    expect(onCreate).toHaveBeenCalledWith(expectedDate);
  });

  test('uses the selected custom date', async () => {
    const onCreate = jest.fn();
    const view = await render(<FollowUpReminderDialog completedOn="2026-08-28" isCreating={false} onCreate={onCreate} onSkip={jest.fn()} taskTitle="Подготовить отчёт" visible />);

    fireEvent.press(view.getByLabelText('Выбрать свою дату напоминания'));
    await waitFor(() => expect(view.getByLabelText('Дата связанного напоминания')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Дата связанного напоминания'));
    await waitFor(() => expect(view.getByLabelText('30 Август 2026')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('30 Август 2026'));
    await waitFor(() => expect(view.getByText('30.08.2026')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Создать напоминание на выбранную дату'));

    expect(onCreate).toHaveBeenCalledWith('2026-08-30');
  });

  test('allows an explicit refusal without creating a reminder', async () => {
    const onCreate = jest.fn();
    const onSkip = jest.fn();
    const view = await render(<FollowUpReminderDialog completedOn="2026-08-28" isCreating={false} onCreate={onCreate} onSkip={onSkip} taskTitle="Подготовить отчёт" visible />);

    fireEvent.press(view.getByLabelText('Не создавать связанное напоминание'));

    expect(onCreate).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
