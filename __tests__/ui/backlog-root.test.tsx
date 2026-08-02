import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { BacklogRootScreen } from '../../src/ui/backlog/backlog-root-screen';

describe('BacklogRootScreen', () => {
  test('shows exactly three approved categories in order without search', async () => {
    const view = await render(
      <AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}>
        <BacklogRootScreen />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Напоминания')).toBeTruthy();
    });

    expect([
      view.getByLabelText('Напоминания'),
      view.getByLabelText('Без проекта'),
      view.getByLabelText('Проекты'),
    ].map((card) => card.props.accessibilityLabel)).toEqual([
      'Напоминания',
      'Без проекта',
      'Проекты',
    ]);
    expect(view.queryByPlaceholderText(/поиск/i)).toBeNull();
  });

  test('creates a reminder with only a title from the root add menu', async () => {
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
      expect(view.getByText('Новое напоминание')).toBeTruthy();
    });
    fireEvent.press(view.getByText('Новое напоминание'));
    await waitFor(() => {
      expect(view.getByLabelText('Название')).toBeTruthy();
    });
    fireEvent.changeText(view.getByLabelText('Название'), 'Проверить ответ');
    await waitFor(() => {
      expect(view.getByLabelText('Название').props.value).toBe('Проверить ответ');
    });
    fireEvent.press(view.getByText('Сохранить'));

    await waitFor(() => {
      expect(view.getByText('Проверить ответ')).toBeTruthy();
    });
  });
});
