import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppServicesProvider } from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';
import { getDailyEnergyForCurrentDay } from '../../src/application/energy-use-cases';
import { getDateInTimeZone } from '../../src/domain/planning';
import { PlanScreen } from '../../src/ui/plan/plan-screen';

describe('daily energy check-in', () => {
  const appInitializationTimeout = 15000;

  test('offers a scrollable 75-percent default when today has no energy entry', async () => {
    const view = await render(
      <AppServicesProvider seedDevelopmentData={false} source={createInMemoryDataSource()}>
        <PlanScreen />
      </AppServicesProvider>,
    );

    await waitFor(() => expect(view.getByText('Энергия на сегодня')).toBeOnTheScreen(), {
      timeout: appInitializationTimeout,
    });
    expect(view.getByLabelText('Энергия 75%').props.accessibilityState).toEqual({ selected: true });
    expect(view.queryByRole('textbox')).toBeNull();
  });

  test('lets the evening review replace a skipped check-in with one daily rating', async () => {
    const source = createInMemoryDataSource();
    const view = await render(
      <AppServicesProvider seedDevelopmentData={false} source={source}>
        <PlanScreen />
      </AppServicesProvider>,
    );

    await waitFor(() => expect(view.getByLabelText('Пропустить оценку энергии')).toBeOnTheScreen(), {
      timeout: appInitializationTimeout,
    });
    await fireEvent.press(view.getByLabelText('Пропустить оценку энергии'));

    await waitFor(async () => {
      await expect(getDailyEnergyForCurrentDay(source)).resolves.toMatchObject({ energyPercent: null });
      expect(view.queryByText('Энергия на сегодня')).toBeNull();
    }, { timeout: appInitializationTimeout });

    await fireEvent.press(view.getByLabelText('Открыть вечернюю проверку'));
    const today = getDateInTimeZone(new Date().toISOString(), 'Europe/Moscow').split('-').reverse().join('.');
    await waitFor(() => expect(view.getByText(`Энергия за ${today}`)).toBeOnTheScreen());
    expect(view.getByText('Не указана')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Указать оценку энергии'));
    await waitFor(() => expect(view.getByLabelText('Энергия 80%')).toBeOnTheScreen());
    await act(async () => {
      await fireEvent.press(view.getByLabelText('Энергия 80%'));
    });
    expect(view.getByLabelText('Энергия 80%').props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(view.getByLabelText('Сохранить оценку энергии'));

    await waitFor(async () => {
      await expect(getDailyEnergyForCurrentDay(source)).resolves.toMatchObject({ energyPercent: 80 });
      expect(view.getByText('80%')).toBeOnTheScreen();
    });
  });

  test('shows the selected historic date energy in a read-only evening review', async () => {
    const source = createInMemoryDataSource();
    const now = new Date();
    const currentDate = getDateInTimeZone(now.toISOString(), 'Europe/Moscow');
    await source.saveDailyEnergyEntry({ recordedOn: currentDate, energyPercent: 75, createdAt: now.toISOString(), updatedAt: now.toISOString() });
    await source.saveDailyEnergyEntry({ recordedOn: '2026-09-15', energyPercent: 58, createdAt: '2026-09-15T08:00:00.000Z', updatedAt: '2026-09-15T08:00:00.000Z' });
    const view = await render(
      <AppServicesProvider seedDevelopmentData={false} source={source}>
        <PlanScreen initialDate="2026-09-15" />
      </AppServicesProvider>,
    );

    await waitFor(() => expect(view.getByLabelText('Открыть вечернюю проверку')).toBeOnTheScreen(), { timeout: appInitializationTimeout });
    await fireEvent.press(view.getByLabelText('Открыть вечернюю проверку'));

    await waitFor(() => expect(view.getByText('Энергия за 15.09.2026')).toBeOnTheScreen(), { timeout: appInitializationTimeout });
    expect(view.getByText('58%')).toBeOnTheScreen();
    expect(view.queryByLabelText('Изменить оценку энергии')).toBeNull();
  }, appInitializationTimeout);
});
