import { StyleSheet, Text } from 'react-native';

import { DevelopmentStorageDiagnostic } from '../../ui/development-storage-diagnostic';
import { ScreenShell } from '../../ui/screen-shell';

export default function SettingsScreen() {
  return (
    <ScreenShell title="Настройки">
      <Text style={styles.description}>
        Настройки рабочего дня появятся в соответствующем эпике.
      </Text>
      {__DEV__ ? <DevelopmentStorageDiagnostic /> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  description: {
    color: '#475467',
    fontSize: 17,
    lineHeight: 25,
  },
});
