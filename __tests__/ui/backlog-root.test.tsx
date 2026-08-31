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

    await fireEvent.press(view.getByLabelText('Добавить элемент'));
    await waitFor(() => {
      expect(view.getByText('Новое напоминание')).toBeTruthy();
    });
    await fireEvent.press(view.getByText('Новое напоминание'));
    await waitFor(() => {
      expect(view.getByLabelText('Название')).toBeTruthy();
    });
    await fireEvent.changeText(view.getByLabelText('Название'), 'Проверить ответ');
    await waitFor(() => {
      expect(view.getByLabelText('Название').props.value).toBe('Проверить ответ');
    });
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(() => {
      expect(view.getByText('Проверить ответ')).toBeTruthy();
    });
  });

  test('shows an explicit category transition for every approved root card', async () => {
    const view = await render(
      <AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}>
        <BacklogRootScreen />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByLabelText('Напоминания')).toBeOnTheScreen();
    });

    expect(view.getAllByText('Открыть раздел')).toHaveLength(2);
    expect(view.getByText('Перейти к проектам')).toBeOnTheScreen();
  });

  test('shows the approved Backlog 2 summary and demo planning callout', async () => {
    const view = await render(
      <AppServicesProvider source={createInMemoryDataSource()} seedDevelopmentData={false}>
        <BacklogRootScreen />
      </AppServicesProvider>,
    );

    await waitFor(() => {
      expect(view.getByText('0 дел ждут планирования')).toBeOnTheScreen();
    });

    expect(
      view.getByText('Демо-планирование: задача откроет форму с параметрами дня.'),
    ).toBeOnTheScreen();
  });
});
