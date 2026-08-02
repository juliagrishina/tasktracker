export const tabDefinitions = [
  { route: 'index', title: 'План' },
  { route: 'backlog', title: 'Backlog' },
  { route: 'completed', title: 'Завершённые' },
  { route: 'settings', title: 'Настройки' },
] as const;

export type TabRoute = (typeof tabDefinitions)[number]['route'];
