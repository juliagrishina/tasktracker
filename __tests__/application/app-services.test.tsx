import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  AppServicesProvider,
  useAppServices,
} from '../../src/application/app-services-provider';
import { createInMemoryDataSource } from '../../src/data/data-source.web';

function ServicesProbe() {
  const { isReady, settings } = useAppServices();

  if (!isReady) {
    return <Text>loading</Text>;
  }

  return <Text>{`${settings.workdayStartsAt}–${settings.workdayEndsAt}`}</Text>;
}

describe('AppServicesProvider', () => {
  test('exposes default settings after initialization', async () => {
    const view = await render(
      <AppServicesProvider source={createInMemoryDataSource()}>
        <ServicesProbe />
      </AppServicesProvider>,
    );

    expect(view.getByText('08:00–22:00')).toBeOnTheScreen();
  });
});
