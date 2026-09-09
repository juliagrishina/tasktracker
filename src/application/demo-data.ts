import type {
  Project,
  RecurrenceSeries,
  Reminder,
  ScheduleBlock,
  TaskItem,
} from '../domain/entities';
import type { AppDataSource } from '../data/contracts';
import { getDateInTimeZone } from '../domain/planning';
import { stableLegacyUuid } from '../domain/uuid';
import type { DemoTask, DemoTaskGroups } from '../ui/demo-tasks';

const createdAt = '2026-08-02T09:00:00.000Z';
const demoId = (entityType: string, legacyId: string): string => stableLegacyUuid(entityType, legacyId);

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
    id: demoId('projects', 'demo-project-personal'),
    title: 'Личное',
    ...projectDefaults,
    createdAt,
  },
  {
    id: demoId('projects', 'demo-project-work'),
    title: 'Работа',
    ...projectDefaults,
    createdAt,
  },
];

const taskItems: readonly TaskItem[] = [
  {
    id: demoId('task_items', 'demo-plan-week-draft'),
    kind: 'task',
    projectId: demoId('projects', 'demo-project-personal'),
    parentTaskId: null,
    title: 'Подготовить черновик недели',
    ...taskDefaults,
    createdAt,
  },
  {
    id: demoId('task_items', 'demo-plan-week-draft-outline'),
    kind: 'subtask',
    projectId: demoId('projects', 'demo-project-personal'),
    parentTaskId: demoId('task_items', 'demo-plan-week-draft'),
    title: 'Собрать пункты для черновика',
    ...taskDefaults,
    createdAt,
  },
  {
    id: demoId('task_items', 'demo-plan-team-call'),
    kind: 'task',
    projectId: demoId('projects', 'demo-project-work'),
    parentTaskId: null,
    title: 'Созвон с командой',
    ...taskDefaults,
    createdAt,
  },
  {
    id: demoId('task_items', 'demo-backlog-inbox'),
    kind: 'task',
    projectId: demoId('projects', 'demo-project-personal'),
    parentTaskId: null,
    title: 'Разобрать входящие заметки',
    ...taskDefaults,
    createdAt,
  },
  {
    id: demoId('task_items', 'demo-backlog-gift'),
    kind: 'task',
    projectId: demoId('projects', 'demo-project-personal'),
    parentTaskId: null,
    title: 'Выбрать подарок маме',
    ...taskDefaults,
    createdAt,
  },
  {
    id: demoId('task_items', 'demo-backlog-reading'),
    kind: 'task',
    projectId: null,
    parentTaskId: null,
    title: 'Сохранить статьи для чтения',
    ...taskDefaults,
    createdAt,
  },
  {
    id: demoId('task_items', 'demo-completed-review'),
    kind: 'task',
    projectId: demoId('projects', 'demo-project-personal'),
    parentTaskId: null,
    title: 'Заполнить итоги дня',
    ...taskDefaults,
    completedAt: '2026-08-02T17:00:00.000Z',
    createdAt,
  },
  {
    id: demoId('task_items', 'demo-completed-brief'),
    kind: 'task',
    projectId: demoId('projects', 'demo-project-work'),
    parentTaskId: null,
    title: 'Отправить краткий статус',
    ...taskDefaults,
    completedAt: '2026-08-02T18:00:00.000Z',
    createdAt,
  },
];

const reminders: readonly Reminder[] = [
  {
    id: demoId('reminders', 'demo-reminder-insurance'),
    title: 'Позвонить в страховую',
    ...reminderDefaults,
    createdAt,
  },
];

function createAcceptanceTasks(isoDate: string): readonly TaskItem[] {
  return [
    {
      id: demoId('task_items', 'demo-evening-review-task'),
      kind: 'task',
      projectId: demoId('projects', 'demo-project-personal'),
      parentTaskId: null,
      title: 'Подвести итоги дня',
      ...taskDefaults,
      scheduledOn: isoDate,
      createdAt,
    },
  ];
}

function createAcceptanceReminders(isoDate: string): readonly Reminder[] {
  return [
    {
      id: demoId('reminders', 'demo-reminder-evening-review'),
      title: 'Подтвердить бронирование',
      ...reminderDefaults,
      remindsOn: isoDate,
      createdAt,
    },
  ];
}

function createScheduleBlocks(now: Date, timeZoneId: string): readonly ScheduleBlock[] {
  const roundedNow = new Date(now);
  roundedNow.setUTCSeconds(0, 0);
  roundedNow.setUTCMinutes(Math.floor(roundedNow.getUTCMinutes() / 5) * 5);
  const completedScenarioEndsAt = new Date(roundedNow.getTime() - 5 * 60_000);
  const completedScenarioStartsAt = new Date(completedScenarioEndsAt.getTime() - 30 * 60_000);
  const upcomingScenarioStartsAt = new Date(roundedNow.getTime() + 60 * 60_000);
  const upcomingScenarioEndsAt = new Date(upcomingScenarioStartsAt.getTime() + 45 * 60_000);

  return [
    {
      id: demoId('schedule_blocks', 'demo-plan-week-draft-block'),
      taskItemId: demoId('task_items', 'demo-plan-week-draft'),
      occurrenceId: null,
      timeZoneId,
      startsAt: completedScenarioStartsAt.toISOString(),
      endsAt: completedScenarioEndsAt.toISOString(),
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    },
    {
      id: demoId('schedule_blocks', 'demo-plan-team-call-block'),
      taskItemId: demoId('task_items', 'demo-plan-team-call'),
      occurrenceId: null,
      timeZoneId,
      startsAt: upcomingScenarioStartsAt.toISOString(),
      endsAt: upcomingScenarioEndsAt.toISOString(),
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    },
  ];
}

function createRecurrenceSeries(isoDate: string): readonly RecurrenceSeries[] {
  return [
    {
      id: demoId('recurrence_series', 'demo-plan-week-draft-recurrence'),
      itemKind: 'task',
      itemId: demoId('task_items', 'demo-plan-week-draft'),
      frequency: 'weekly',
      interval: 1,
      startsOn: isoDate,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    },
  ];
}

interface DemoTaskDefinition {
  id: string;
  detail: string;
}

const planDefinitions: readonly DemoTaskDefinition[] = [
  { id: demoId('task_items', 'demo-plan-week-draft'), detail: '09:00–09:30 · Личное' },
  { id: demoId('task_items', 'demo-plan-team-call'), detail: '11:00–11:45 · Работа' },
];

const backlogDefinitions: readonly DemoTaskDefinition[] = [
  { id: demoId('task_items', 'demo-backlog-inbox'), detail: 'Без даты · Личное' },
  { id: demoId('task_items', 'demo-backlog-gift'), detail: 'До конца недели · Личное' },
  { id: demoId('task_items', 'demo-backlog-reading'), detail: 'Без даты · Саморазвитие' },
];

const completedDefinitions: readonly DemoTaskDefinition[] = [
  { id: demoId('task_items', 'demo-completed-review'), detail: 'Завершено сегодня · Личное' },
  { id: demoId('task_items', 'demo-completed-brief'), detail: 'Завершено сегодня · Работа' },
];

export async function seedDemoData(source: AppDataSource): Promise<void> {
  await source.initialize();
  const settings = await source.getSettings();
  const now = new Date();
  const currentDate = getDateInTimeZone(now.toISOString(), settings.timeZoneId);

  for (const project of projects) {
    await source.saveProject(project);
  }

  for (const task of [...taskItems, ...createAcceptanceTasks(currentDate)]) {
    await source.saveTaskItem(task);
  }

  for (const reminder of [...reminders, ...createAcceptanceReminders(currentDate)]) {
    await source.saveReminder(reminder);
  }

  for (const block of createScheduleBlocks(now, settings.timeZoneId)) {
    await source.saveScheduleBlock(block);
  }

  for (const series of createRecurrenceSeries(currentDate)) {
    await source.saveRecurrenceSeries(series);
  }

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
