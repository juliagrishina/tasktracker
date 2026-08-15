import {
  loadDemoTaskGroups,
  seedDemoData,
} from '../../src/application/demo-data';
import { getBacklogView } from '../../src/application/backlog-use-cases';
import { createInMemoryDataSource } from '../../src/data/data-source.web';

describe('development demo data', () => {
  test('seeds every entity once and exposes cards for each task tab', async () => {
    const source = createInMemoryDataSource();

    await seedDemoData(source);
    await seedDemoData(source);

    await expect(source.getProject('demo-project-personal')).resolves.not.toBeNull();
    await expect(source.getTaskItem('demo-plan-week-draft')).resolves.not.toBeNull();
    await expect(source.getReminder('demo-reminder-insurance')).resolves.not.toBeNull();
    await expect(source.getScheduleBlock('demo-plan-week-draft-block')).resolves.not.toBeNull();
    await expect(source.getRecurrenceSeries('demo-plan-week-draft-recurrence')).resolves.not.toBeNull();
    await expect(source.getTaskItem('demo-completed-review')).resolves.toMatchObject({
      completedAt: expect.any(String),
    });
    await expect(source.getSettings()).resolves.toMatchObject({
      notificationLeadMinutes: 15,
    });
    expect(source.debugSettingsRowCount()).toBe(1);

    const groups = await loadDemoTaskGroups(source);

    expect(groups.plan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Подготовить черновик недели' }),
      ]),
    );
    expect(groups.backlog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Разобрать входящие заметки' }),
      ]),
    );
    expect(groups.completed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Заполнить итоги дня' }),
      ]),
    );

    const backlog = await getBacklogView(source);

    expect(backlog.reminders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Позвонить в страховую' }),
      ]),
    );
    expect(backlog.unassignedTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ task: expect.objectContaining({ title: 'Сохранить статьи для чтения' }) }),
      ]),
    );
    expect(backlog.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ project: expect.objectContaining({ title: 'Личное' }) }),
      ]),
    );
  });
});
