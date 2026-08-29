import { useAppServices } from '../../application/app-services-provider';
import { notificationPermissionGateway } from '../../application/notification-permission-gateway';
import { SettingsStatePanel } from '../../ui/settings/settings-state-panel';

export default function SettingsScreen() {
  const { settings, settingsActions } = useAppServices();

  return <SettingsStatePanel notificationPermissions={notificationPermissionGateway} onPlanningSettingsChange={settingsActions.updatePlanningSettings} onTimeZoneChange={settingsActions.updateTimeZone} onUseDeviceTimeZone={settingsActions.useDeviceTimeZone} settings={settings} />;
}
