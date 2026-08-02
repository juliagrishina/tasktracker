import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  AppServicesProvider,
  useAppServices,
} from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';

function ServicesProbe() {
  const { demoTasks, isReady, settings } = useAppServices();

  if (!isReady) {
    return <Text>loading</Text>;
  }

  return (
    <Text>{`${settings.notificationLeadMinutes}:${demoTasks.plan[0]?.title ?? 'нет данных'}`}</Text>
  );
}

describe('AppServicesProvider', () => {
  test('exposes seeded settings and Plan demo data after initialization', async () => {
    const view = await render(
      <AppServicesProvider source={createInMemoryDataSource()}>
        <ServicesProbe />
      </AppServicesProvider>,
    );

    expect(view.getByText('15:Подготовить черновик недели')).toBeOnTheScreen();
  });
});
