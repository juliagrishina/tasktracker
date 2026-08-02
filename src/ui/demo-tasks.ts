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

export const emptyDemoTaskGroups: DemoTaskGroups = {
  plan: [],
  backlog: [],
  completed: [],
};
