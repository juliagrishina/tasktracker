import { useRouter } from 'expo-router';

import { useAppServices } from '../../../application/app-services-provider';
import { TreeList } from '../../../ui/backlog/tree-list';
import { ScreenShell } from '../../../ui/screen-shell';

export default function UnassignedRoute() {
  const router = useRouter();
  const { backlog } = useAppServices();

  return (
    <ScreenShell onBack={() => router.back()} title="Без проекта">
      <TreeList
        emptyText="Добавьте задачу без проекта, чтобы она появилась здесь."
        onOpenItem={(id, kind) => router.push({ pathname: '/backlog/item/[id]', params: { id, kind } })}
        trees={backlog.unassignedTasks}
      />
    </ScreenShell>
  );
}
