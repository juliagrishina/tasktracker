import { StyleSheet, Text } from 'react-native';

import { useAppServices } from '../../application/app-services-provider';
import { ScreenShell } from '../../ui/screen-shell';

export default function SettingsScreen() {
  const { settings } = useAppServices();

  return (
    <ScreenShell title="Настройки">
      <Text style={styles.description}>
        Напоминание заранее: {settings.notificationLeadMinutes} минут.
      </Text>
      <Text style={styles.hint}>
        Полное редактирование настроек появится в соответствующем эпике.
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  description: {
    color: '#475467',
    fontSize: 17,
    lineHeight: 25,
  },
  hint: {
    marginTop: 12,
    color: '#667085',
    fontSize: 15,
    lineHeight: 22,
  },
});
