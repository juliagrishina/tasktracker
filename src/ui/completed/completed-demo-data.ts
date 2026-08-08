export type CompletedDemoKind = 'project' | 'reminder' | 'task';

export interface CompletedDemoItem {
  detail: string;
  id: string;
  kind: CompletedDemoKind;
  time: string;
  title: string;
}

export interface CompletedDemoGroup {
  id: string;
  items: readonly CompletedDemoItem[];
  title: string;
}

export const completedDemoGroups: readonly CompletedDemoGroup[] = [
  {
    id: 'today',
    title: 'Сегодня',
    items: [
      { detail: 'Проект «iOS-планировщик»', id: 'structure', kind: 'task', time: '09:32', title: 'Согласовать структуру' },
      { detail: 'Напоминание', id: 'details', kind: 'reminder', time: '08:15', title: 'Отправить реквизиты' },
      { detail: 'Без проекта', id: 'equipment', kind: 'task', time: '07:48', title: 'Заказать оборудование' },
    ],
  },
  {
    id: 'yesterday',
    title: 'Вчера · 2 августа',
    items: [
      { detail: 'Проект · завершён вручную', id: 'research', kind: 'project', time: '18:20', title: 'Исследование конкурентов' },
      { detail: 'Проект «Исследование конкурентов»', id: 'feedback', kind: 'task', time: '17:05', title: 'Собрать обратную связь' },
    ],
  },
  {
    id: 'july-31',
    title: '31 июля',
    items: [
      { detail: 'Проект «Продажи»', id: 'presentation', kind: 'task', time: '16:40', title: 'Обновить презентацию' },
    ],
  },
];
