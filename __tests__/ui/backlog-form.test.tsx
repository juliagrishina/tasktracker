import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AppServicesProvider, useAppServices } from '../../src/application/app-services-provider';
import { createProject, createTask } from '../../src/application/backlog-use-cases';
import { getPlanLoad } from '../../src/application/planning-use-cases';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { BacklogRootScreen } from '../../src/ui/backlog/backlog-root-screen';
import { ItemFormSheet } from '../../src/ui/backlog/item-form-sheet';

type RenderedView = Awaited<ReturnType<typeof render>>;

function ProviderReady() {
  return <Text testID="provider-status">{useAppServices().isReady ? 'ready' : 'loading'}</Text>;
}

async function waitForProvider(view: RenderedView) {
  await waitFor(() => expect(view.getByTestId('provider-status')).toHaveTextContent('ready'));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function choosePickerValue(view: RenderedView, triggerLabel: string, optionLabel: string) {
  await waitFor(() => {
    expect(view.getByLabelText(triggerLabel)).toBeOnTheScreen();
  });
  await fireEvent.press(view.getByLabelText(triggerLabel));
  await waitFor(() => {
    expect(view.getByLabelText(optionLabel)).toBeOnTheScreen();
  });
  await fireEvent.press(view.getByLabelText(optionLabel));
}

async function chooseSelectedPickerValue(view: RenderedView, triggerLabel: string) {
  await fireEvent.press(view.getByLabelText(triggerLabel));
  const selectedOption = await waitFor(() => {
    const option = view.getAllByRole('button').find((candidate) => (
      candidate.props.accessibilityState?.selected === true
      && /^\d{2}:\d{2}/.test(candidate.props.accessibilityLabel ?? '')
    ));
    expect(option).toBeDefined();
    return option;
  });
  await fireEvent.press(selectedOption!);
}

async function chooseCalendarDate(view: RenderedView, triggerLabel: string, dayLabel: string) {
  const day = view.queryByLabelText(dayLabel);
  if (day === null) {
    await fireEvent.press(view.getByLabelText(triggerLabel));
  }
  await waitFor(() => {
    expect(view.getByLabelText(dayLabel)).toBeOnTheScreen();
  });
  await fireEvent.press(view.getByLabelText(dayLabel));
  await waitFor(() => {
    expect(view.getByLabelText(triggerLabel).props.accessibilityState?.expanded).toBe(false);
  });
}

describe('Backlog item form', () => {
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

  test('saves a no-time reminder estimate and adds it to the selected day load', async () => {
    const source = createInMemoryDataSource();
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <ProviderReady />
        <ItemFormSheet
          mode="create"
          onClose={jest.fn()}
          planningContext={{ defaultDate: '2026-08-13' }}
          type="reminder"
          visible
        />
      </AppServicesProvider>,
    );
    await waitForProvider(view);

    await fireEvent.changeText(view.getByLabelText('Название'), 'Оплатить страховку');
    await fireEvent.press(view.getByRole('button', { name: 'Дата' }));
    await waitFor(() => {
      expect(view.getByLabelText('Дата напоминания')).toBeOnTheScreen();
    });
    await chooseCalendarDate(view, 'Дата напоминания', '15 августа 2026');
    await choosePickerValue(view, 'Оценочная длительность', '45 мин');
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(async () => {
      await expect(source.listReminders()).resolves.toContainEqual(
        expect.objectContaining({
          title: 'Оплатить страховку',
          remindsOn: '2026-08-15',
          estimatedDurationMinutes: 45,
        }),
      );
    });
    await expect(getPlanLoad(source, '2026-08-15')).resolves.toBeCloseTo((45 / 840) * 100);
    await expect(source.listScheduleBlocks()).resolves.toHaveLength(0);
  });

  test('saves reminder period and recurrence through picker-only planning controls', async () => {
    const source = createInMemoryDataSource();
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <ProviderReady />
        <ItemFormSheet
          mode="create"
          onClose={jest.fn()}
          planningContext={{ defaultDate: '2026-08-13' }}
          type="reminder"
          visible
        />
      </AppServicesProvider>,
    );
    await waitForProvider(view);

    await fireEvent.changeText(view.getByLabelText('Название'), 'Проверить документы');
    await fireEvent.press(view.getByRole('button', { name: 'Период' }));
    await waitFor(() => {
      expect(view.getByLabelText('Начало периода напоминания')).toBeOnTheScreen();
    });
    await chooseCalendarDate(view, 'Начало периода напоминания', '15 августа 2026');
    await chooseCalendarDate(view, 'Конец периода напоминания', '17 августа 2026');
    await fireEvent.press(view.getByRole('button', { name: 'Каждый день' }));
    await choosePickerValue(view, 'Оценочная длительность', '30 мин');
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(async () => {
      await expect(source.listReminders()).resolves.toContainEqual(expect.objectContaining({
        periodStartOn: '2026-08-15',
        periodEndOn: '2026-08-17',
        repeatRule: { frequency: 'daily', interval: 1 },
      }));
    });
    await expect(source.listRecurrenceSeries()).resolves.toContainEqual(
      expect.objectContaining({ itemKind: 'reminder', frequency: 'daily', startsOn: '2026-08-15' }),
    );
  });

  test('converts a timed reminder into a task only after picker selection and confirmation', async () => {
    const source = createInMemoryDataSource();
    await createProject(source, {
      id: 'project-reminder',
      title: 'Работа',
      createdAt: '2026-08-10T08:00:00.000Z',
    });
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <ProviderReady />
        <ItemFormSheet
          mode="create"
          onClose={jest.fn()}
          planningContext={{ defaultDate: '2026-08-10' }}
          type="reminder"
          visible
        />
      </AppServicesProvider>,
    );
    await waitForProvider(view);

    await fireEvent.changeText(view.getByLabelText('Название'), 'Позвонить клиенту');
    await fireEvent.press(view.getByRole('button', { name: 'Дата' }));
    await waitFor(() => {
      expect(view.getByLabelText('Дата напоминания')).toBeOnTheScreen();
    });
    await chooseCalendarDate(view, 'Дата напоминания', '10 августа 2026');
    await choosePickerValue(view, 'Оценочная длительность', '30 мин');
    await fireEvent.press(view.getByRole('button', { name: 'Добавить точное время' }));
    await chooseSelectedPickerValue(view, 'Начало точного времени');
    await chooseSelectedPickerValue(view, 'Конец точного времени');
    await fireEvent.press(view.getByLabelText('Выбрать проект'));
    await fireEvent.press(view.getByText('Работа'));
    await fireEvent.press(view.getByText('Сохранить'));

    await waitFor(() => {
      expect(view.getByText('Преобразовать напоминание в задачу?')).toBeOnTheScreen();
    });
    await expect(source.listReminders()).resolves.toHaveLength(1);
    await expect(source.listTaskItems()).resolves.toHaveLength(0);

    await fireEvent.press(view.getByText('Преобразовать'));
    await waitFor(async () => {
      await expect(source.listReminders()).resolves.toHaveLength(0);
    });
    await expect(source.listTaskItems()).resolves.toContainEqual(
      expect.objectContaining({ projectId: 'project-reminder', title: 'Позвонить клиенту' }),
    );
    await expect(source.listScheduleBlocks()).resolves.toContainEqual(expect.objectContaining({
      startsAt: expect.stringContaining('2026-08-10T'),
    }));
  });

  test('saves an independently planned subtask with picker-selected date and time', async () => {
    const source = createInMemoryDataSource();
    const parent = await createTask(source, {
      id: 'subtask-parent',
      title: 'Родительская задача',
      createdAt: '2026-08-10T08:00:00.000Z',
    });
    const view = await render(
      <AppServicesProvider source={source} seedDevelopmentData={false}>
        <ProviderReady />
        <ItemFormSheet
          mode="create"
          onClose={jest.fn()}
          parentTaskId={parent.id}
          planningContext={{ defaultDate: '2026-08-10' }}
          type="subtask"
          visible
        />
      </AppServicesProvider>,
    );
    await waitForProvider(view);

    await fireEvent.changeText(view.getByLabelText('Название'), 'Проверить данные');
    await fireEvent.press(view.getByRole('button', { name: 'Дата' }));
    await waitFor(() => {
      expect(view.getByLabelText('Дата задачи')).toBeOnTheScreen();
    });
    await chooseCalendarDate(view, 'Дата задачи', '10 августа 2026');
    await fireEvent.press(view.getByLabelText('Добавить временной интервал'));
    await chooseSelectedPickerValue(view, 'Начало интервала 1');
    await chooseSelectedPickerValue(view, 'Конец интервала 1');
    await fireEvent.press(view.getByText('Создать'));

    await waitFor(async () => {
      await expect(source.listScheduleBlocks()).resolves.toHaveLength(1);
    });
    await expect(source.listTaskItems()).resolves.toContainEqual(
      expect.objectContaining({
        kind: 'subtask',
        scheduledOn: '2026-08-10',
        title: 'Проверить данные',
      }),
    );
  });
});
