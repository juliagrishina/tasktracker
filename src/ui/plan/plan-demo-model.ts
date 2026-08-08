export interface PlanDemoListItem {
  detail: string;
  title: string;
  tone: 'meeting' | 'task';
}

export const planDemoModel = {
  completion: 35,
  date: '3 августа, понедельник',
  energy: 'энергия 70%',
  nextEvent: {
    detail: 'Следующее · через 18 минут',
    title: 'Планёрка команды · Teams',
  },
  planned: '6 ч 20 м из 14 ч',
  schedule: [
    { detail: 'Microsoft Teams', time: '09:15\n10:00', title: 'Планёрка команды', tone: 'meeting' },
    { detail: 'Проект «iOS MVP»', time: '10:30\n11:30', title: 'Собрать прототип', tone: 'task' },
    { detail: '1 ч 30 минут', time: '13:00\n14:30', title: 'Подготовить презентацию', tone: 'task' },
  ] satisfies readonly (PlanDemoListItem & { time: string })[],
  untimed: [
    { detail: 'Без оценки', title: 'Позвонить в банк', tone: 'task' },
    { detail: 'Оценка 45 минут', title: 'Отчёт до пятницы', tone: 'task' },
  ] satisfies readonly PlanDemoListItem[],
} as const;
