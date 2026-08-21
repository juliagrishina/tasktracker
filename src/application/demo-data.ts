import type {
  Project,
  RecurrenceSeries,
  Reminder,
  ScheduleBlock,
  TaskItem,
} from '../domain/entities';
import type { AppDataSource } from '../data/contracts';
import type { DemoTask, DemoTaskGroups } from '../ui/demo-tasks';

const createdAt = '2026-08-02T09:00:00.000Z';

const projectDefaults = {
  description: null,
  completedAt: null,
  updatedAt: createdAt,
  deletedAt: null,
} as const;

const taskDefaults = {
  description: null,
  estimatedDurationMinutes: null,
  completedAt: null,
  updatedAt: createdAt,
  deletedAt: null,
} as const;

const reminderDefaults = {
  remindsOn: null,
  periodStartOn: null,
  periodEndOn: null,
  repeatRule: null,
  estimatedDurationMinutes: null,
  completedAt: null,
  updatedAt: createdAt,
  deletedAt: null,
} as const;

const projects: readonly Project[] = [
  {
    id: 'demo-project-personal',
    title: 'Личное',
    ...projectDefaults,
    createdAt,
  },
  {
    id: 'demo-project-work',
    title: 'Работа',
    ...projectDefaults,
    createdAt,
  },
];

const taskItems: readonly TaskItem[] = [
  {
    id: 'demo-plan-week-draft',
    kind: 'task',
    projectId: 'demo-project-personal',
    parentTaskId: null,
    title: 'Подготовить черновик недели',
    ...taskDefaults,
    createdAt,
  },
  {
    id: 'demo-plan-week-draft-outline',
    kind: 'subtask',
    projectId: 'demo-project-personal',
    parentTaskId: 'demo-plan-week-draft',
    title: 'Собрать пункты для черновика',
    ...taskDefaults,
    createdAt,
  },
  {
    id: 'demo-plan-team-call',
    kind: 'task',
    projectId: 'demo-project-work',
    parentTaskId: null,
    title: 'Созвон с командой',
    ...taskDefaults,
    createdAt,
  },
  {
    id: 'demo-backlog-inbox',
    kind: 'task',
    projectId: 'demo-project-personal',
    parentTaskId: null,
    title: 'Разобрать входящие заметки',
    ...taskDefaults,
    createdAt,
  },
  {
    id: 'demo-backlog-gift',
    kind: 'task',
    projectId: 'demo-project-personal',
    parentTaskId: null,
    title: 'Выбрать подарок маме',
    ...taskDefaults,
    createdAt,
  },
  {
    id: 'demo-backlog-reading',
    kind: 'task',
    projectId: null,
    parentTaskId: null,
    title: 'Сохранить статьи для чтения',
    ...taskDefaults,
    createdAt,
  },
  {
    id: 'demo-completed-review',
    kind: 'task',
    projectId: 'demo-project-personal',
    parentTaskId: null,
    title: 'Заполнить итоги дня',
    ...taskDefaults,
    completedAt: '2026-08-02T17:00:00.000Z',
    createdAt,
  },
  {
    id: 'demo-completed-brief',
    kind: 'task',
    projectId: 'demo-project-work',
    parentTaskId: null,
    title: 'Отправить краткий статус',
    ...taskDefaults,
    completedAt: '2026-08-02T18:00:00.000Z',
    createdAt,
  },
];

const reminders: readonly Reminder[] = [
  {
    id: 'demo-reminder-insurance',
    title: 'Позвонить в страховую',
    ...reminderDefaults,
    createdAt,
  },
];

const scheduleBlocks: readonly ScheduleBlock[] = [
  {
    id: 'demo-plan-week-draft-block',
    taskItemId: 'demo-plan-week-draft',
    occurrenceId: null,
    timeZoneId: null,
    startsAt: '2026-08-02T09:00:00.000Z',
    endsAt: '2026-08-02T09:30:00.000Z',
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  },
  {
    id: 'demo-plan-team-call-block',
    taskItemId: 'demo-plan-team-call',
    occurrenceId: null,
    timeZoneId: null,
    startsAt: '2026-08-02T11:00:00.000Z',
    endsAt: '2026-08-02T11:45:00.000Z',
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  },
];

const recurrenceSeries: readonly RecurrenceSeries[] = [
  {
    id: 'demo-plan-week-draft-recurrence',
    itemKind: 'task',
    itemId: 'demo-plan-week-draft',
    frequency: 'weekly',
    interval: 1,
    startsOn: '2026-08-02',
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  },
];

interface DemoTaskDefinition {
  id: string;
  detail: string;
}

const planDefinitions: readonly DemoTaskDefinition[] = [
  { id: 'demo-plan-week-draft', detail: '09:00–09:30 · Личное' },
  { id: 'demo-plan-team-call', detail: '11:00–11:45 · Работа' },
];

const backlogDefinitions: readonly DemoTaskDefinition[] = [
  { id: 'demo-backlog-inbox', detail: 'Без даты · Личное' },
  { id: 'demo-backlog-gift', detail: 'До конца недели · Личное' },
  { id: 'demo-backlog-reading', detail: 'Без даты · Саморазвитие' },
];

const completedDefinitions: readonly DemoTaskDefinition[] = [
  { id: 'demo-completed-review', detail: 'Завершено сегодня · Личное' },
  { id: 'demo-completed-brief', detail: 'Завершено сегодня · Работа' },
];

export async function seedDemoData(source: AppDataSource): Promise<void> {
  await source.initialize();

  for (const project of projects) {
    await source.saveProject(project);
  }

  for (const task of taskItems) {
    await source.saveTaskItem(task);
  }

  for (const reminder of reminders) {
    await source.saveReminder(reminder);
  }

  for (const block of scheduleBlocks) {
    await source.saveScheduleBlock(block);
  }

  for (const series of recurrenceSeries) {
    await source.saveRecurrenceSeries(series);
  }

  const settings = await source.getSettings();
  await source.saveSettings({ ...settings, notificationLeadMinutes: 15 });
}

export async function loadDemoTaskGroups(
  source: AppDataSource,
): Promise<DemoTaskGroups> {
  const [plan, backlog, completed] = await Promise.all([
    loadGroup(source, planDefinitions),
    loadGroup(source, backlogDefinitions),
    loadGroup(source, completedDefinitions),
  ]);

  return { plan, backlog, completed };
}

async function loadGroup(
  source: AppDataSource,
  definitions: readonly DemoTaskDefinition[],
): Promise<readonly DemoTask[]> {
  const tasks = await Promise.all(
    definitions.map(async (definition) => {
      const task = await source.getTaskItem(definition.id);

      return task === null
        ? null
        : {
            id: task.id,
            title: task.title,
            detail: definition.detail,
          };
    }),
  );

  return tasks.filter((task): task is DemoTask => task !== null);
}
