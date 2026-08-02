import { useRouter } from 'expo-router';

import { BacklogRootScreen } from '../../../ui/backlog/backlog-root-screen';

export default function BacklogRootRoute() {
  const router = useRouter();

  return (
    <BacklogRootScreen
      onOpenCategory={(category) => router.push(`/backlog/${category}`)}
    />
  );
}
