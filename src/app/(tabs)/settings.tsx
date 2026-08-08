import { useAppServices } from '../../application/app-services-provider';
import { SettingsStatePanel } from '../../ui/settings/settings-state-panel';

export default function SettingsScreen() {
  const { settings } = useAppServices();

  return <SettingsStatePanel settings={settings} />;
}
