import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { StyleSheet } from 'react-native';

import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { BacklogRootScreen } from '../../src/ui/backlog/backlog-root-screen';
import { ItemFormSheet } from '../../src/ui/backlog/item-form-sheet';

describe('Backlog item form', () => {
  test('lets a recurring reminder select days of the week', async () => {
    const view = await render(<AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}><BacklogRootScreen /></AppServicesProvider>);
    await waitFor(() => expect(view.getByLabelText('Добавить элемент')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Добавить элемент'));
    await waitFor(() => expect(view.getByText('Новое напоминание')).toBeOnTheScreen());
    await fireEvent.press(view.getByText('Новое напоминание'));
    await waitFor(() => expect(view.getByText('Каждую неделю')).toBeOnTheScreen());
    await fireEvent.press(view.getByText('Каждую неделю'));
    await waitFor(() => expect(view.getByLabelText('Пн')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Пн'));
  });

  test('keeps the form open and displays validation when saving a blank title', async () => {
    const view = await render(
      <AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}>
        <BacklogRootScreen />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Добавить элемент')).toBeOnTheScreen();
    });

    await fireEvent.press(view.getByLabelText('Добавить элемент'));
    await waitFor(() => {
      expect(view.getByText('Новая задача')).toBeTruthy();
    });
    await fireEvent.press(view.getByText('Новая задача'));
    await waitFor(() => {
      expect(view.getByText('Сохранить')).toBeTruthy();
    });
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(() => {
      expect(view.getByText('Название обязательно')).toBeTruthy();
    });
    expect(view.getByLabelText('Название')).toBeTruthy();
  });

  test('lays out four edit actions as accessible two-column controls', async () => {
    const view = await render(
      <AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}>
        <ItemFormSheet
          item={{ id: 'task-1', kind: 'task', projectId: null, parentTaskId: null, title: 'Задача', description: null, estimatedDurationMinutes: null, scheduledOn: null, periodStartOn: null, periodEndOn: null, completedAt: null, createdAt: '2026-09-14T10:00:00.000Z', updatedAt: '2026-09-14T10:00:00.000Z', deletedAt: null }}
          mode="edit"
          onClose={() => {}}
          onComplete={async () => {}}
          onDelete={async () => {}}
          type="task"
          visible
        />
      </AppServicesProvider>,
    );

    await waitFor(() => expect(view.getByTestId('item-form-actions')).toBeOnTheScreen());
    expect(StyleSheet.flatten(view.getByTestId('item-form-actions').props.style)).toMatchObject({ flexWrap: 'wrap' });
    for (const testId of ['item-form-action-cancel', 'item-form-action-complete', 'item-form-action-delete', 'item-form-action-save']) {
      expect(StyleSheet.flatten(view.getByTestId(testId).props.style)).toMatchObject({ minHeight: 44, width: '48%' });
    }
  });
});
