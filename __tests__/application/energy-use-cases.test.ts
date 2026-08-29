import { createInMemoryDataSource } from '../../src/data/data-source.web';
import {
  getDailyEnergyForCurrentDay,
  saveDailyEnergyForCurrentDay,
} from '../../src/application/energy-use-cases';

describe('daily energy use cases', () => {
  test('stores an energy rating against the current calendar day in the effective timezone', async () => {
    const source = createInMemoryDataSource();
    await source.saveSettings({
      timeZoneId: 'Europe/Moscow',
      timeZoneMode: 'manual',
      workdayStartsAt: '09:00',
      workdayEndsAt: '18:00',
      eveningReviewAt: '20:00',
      notificationLeadMinutes: 10,
    });

    const entry = await saveDailyEnergyForCurrentDay(source, {
      energyPercent: 70,
      now: new Date('2026-08-03T22:30:00.000Z'),
    });

    expect(entry).toEqual({
      recordedOn: '2026-08-04',
      energyPercent: 70,
      createdAt: '2026-08-03T22:30:00.000Z',
      updatedAt: '2026-08-03T22:30:00.000Z',
    });
    await expect(getDailyEnergyForCurrentDay(source, new Date('2026-08-03T22:30:00.000Z')))
      .resolves.toEqual(entry);
  });

  test('records an explicit skip as a daily energy entry', async () => {
    const source = createInMemoryDataSource();
    const now = new Date('2026-08-04T08:00:00.000Z');

    await expect(saveDailyEnergyForCurrentDay(source, { energyPercent: null, now }))
      .resolves.toEqual({
        recordedOn: '2026-08-04',
        energyPercent: null,
        createdAt: '2026-08-04T08:00:00.000Z',
        updatedAt: '2026-08-04T08:00:00.000Z',
      });
    await expect(getDailyEnergyForCurrentDay(source, now)).resolves.not.toBeNull();
  });

  test('updates the existing mark instead of creating another entry for the same day', async () => {
    const source = createInMemoryDataSource();
    await saveDailyEnergyForCurrentDay(source, {
      energyPercent: 55,
      now: new Date('2026-08-04T08:00:00.000Z'),
    });

    await expect(saveDailyEnergyForCurrentDay(source, {
      energyPercent: 80,
      now: new Date('2026-08-04T18:00:00.000Z'),
    })).resolves.toEqual({
      recordedOn: '2026-08-04',
      energyPercent: 80,
      createdAt: '2026-08-04T08:00:00.000Z',
      updatedAt: '2026-08-04T18:00:00.000Z',
    });
  });

  test('rejects a value that is not a five-percent step', async () => {
    const source = createInMemoryDataSource();

    await expect(saveDailyEnergyForCurrentDay(source, {
      energyPercent: 72,
      now: new Date('2026-08-04T08:00:00.000Z'),
    })).rejects.toThrow('с шагом 5');
    await expect(getDailyEnergyForCurrentDay(source, new Date('2026-08-04T08:00:00.000Z')))
      .resolves.toBeNull();
  });
});
