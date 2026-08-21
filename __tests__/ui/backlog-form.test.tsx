import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { BacklogRootScreen } from '../../src/ui/backlog/backlog-root-screen';

describe('Backlog item form', () => {
  test('lets a recurring reminder select days of the week', async () => {
    const view = await render(<AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}><BacklogRootScreen /></AppServicesProvider>);
    await waitFor(() => expect(view.getByLabelText('Добавить элемент')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Добавить элемент'));
    await waitFor(() => expect(view.getByText('Новое напоминание')).toBeOnTheScreen());
    fireEvent.press(view.getByText('Новое напоминание'));
    await waitFor(() => expect(view.getByText('Каждую неделю')).toBeOnTheScreen());
    fireEvent.press(view.getByText('Каждую неделю'));
    await waitFor(() => expect(view.getByLabelText('Пн')).toBeOnTheScreen());
    fireEvent.press(view.getByLabelText('Пн'));
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

    fireEvent.press(view.getByLabelText('Добавить элемент'));
    await waitFor(() => {
      expect(view.getByText('Новая задача')).toBeTruthy();
    });
    fireEvent.press(view.getByText('Новая задача'));
    await waitFor(() => {
      expect(view.getByText('Сохранить')).toBeTruthy();
    });
    fireEvent.press(view.getByText('Сохранить'));

    await waitFor(() => {
      expect(view.getByText('Название обязательно')).toBeTruthy();
    });
    expect(view.getByLabelText('Название')).toBeTruthy();
  });
});
