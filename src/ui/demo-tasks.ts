export interface DemoTask {
  id: string;
  title: string;
  detail: string;
}

export interface DemoTaskGroups {
  plan: readonly DemoTask[];
  backlog: readonly DemoTask[];
  completed: readonly DemoTask[];
}

const emptyDemoTasks: DemoTaskGroups = {
  plan: [],
  backlog: [],
  completed: [],
};

const browserDemoTasks: DemoTaskGroups = {
  plan: [
    {
      id: 'demo-plan-week-draft',
      title: 'Подготовить черновик недели',
      detail: '09:00–09:30 · Личный проект',
    },
    {
      id: 'demo-plan-team-call',
      title: 'Созвон с командой',
      detail: '11:00–11:45 · Работа',
    },
  ],
  backlog: [
    {
      id: 'demo-backlog-inbox',
      title: 'Разобрать входящие заметки',
      detail: 'Без даты · Личное',
    },
    {
      id: 'demo-backlog-gift',
      title: 'Выбрать подарок маме',
      detail: 'До конца недели · Личное',
    },
    {
      id: 'demo-backlog-reading',
      title: 'Сохранить статьи для чтения',
      detail: 'Без даты · Саморазвитие',
    },
  ],
  completed: [
    {
      id: 'demo-completed-review',
      title: 'Заполнить итоги дня',
      detail: 'Завершено сегодня · Личное',
    },
    {
      id: 'demo-completed-brief',
      title: 'Отправить краткий статус',
      detail: 'Завершено сегодня · Работа',
    },
  ],
};

export function getDemoTasks(platform: string): DemoTaskGroups {
  return platform === 'web' ? browserDemoTasks : emptyDemoTasks;
}
