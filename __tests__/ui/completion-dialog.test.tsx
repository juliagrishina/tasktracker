import { fireEvent, render } from '@testing-library/react-native';

import { CompletionDialog } from '../../src/ui/plan/completion-dialog';

describe('CompletionDialog', () => {
  test('confirms completion', async () => {
    const onComplete = jest.fn();
    const onRequestClose = jest.fn();
    const view = await render(
      <CompletionDialog
        isCompleting={false}
        onComplete={onComplete}
        onRequestClose={onRequestClose}
        taskTitle="Подготовить отчёт"
        visible
      />,
    );

    expect(view.getByText('Удалось закончить?')).toBeOnTheScreen();
    expect(view.getByText('«Подготовить отчёт» завершено?')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Да, завершить дело'));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  test('defers the decision without completing the item', async () => {
    const onComplete = jest.fn();
    const onRequestClose = jest.fn();
    const view = await render(
      <CompletionDialog
        isCompleting={false}
        onComplete={onComplete}
        onRequestClose={onRequestClose}
        taskTitle="Подготовить отчёт"
        visible
      />,
    );

    await fireEvent.press(view.getByLabelText('Отложить решение о завершении'));

    expect(onComplete).not.toHaveBeenCalled();
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });
});
