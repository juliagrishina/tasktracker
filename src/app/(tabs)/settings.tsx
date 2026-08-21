import { useAppServices } from '../../application/app-services-provider';
import { SettingsStatePanel } from '../../ui/settings/settings-state-panel';

export default function SettingsScreen() {
  const { settings, settingsActions } = useAppServices();

  return <SettingsStatePanel onTimeZoneChange={settingsActions.updateTimeZone} settings={settings} />;
}
