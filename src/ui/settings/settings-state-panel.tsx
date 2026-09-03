import { Ionicons } from '@expo/vector-icons';
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createNotificationPermissionService,
  type NotificationPermissionGateway,
  type NotificationPermissionStatus,
  type WebNotificationPermissionGateway,
} from '../../application/notification-permissions';
import type { AccountProfileResult, AccountProfileState } from '../../application/account-profile';
import type { UpdatePlanningSettingsInput } from '../../application/settings-use-cases';
import type { AppSettings } from '../../domain/entities';
import { PlanningValuePicker } from '../backlog/planning-value-picker';
import { designTokens } from '../design/tokens';
import { ActionButton } from '../primitives/action-button';
import { StatusPill } from '../primitives/status-pill';
import { SurfaceCard } from '../primitives/surface-card';
import { temporaryWebContentStyle } from '../screen-shell';

import { settingsDemoState } from './settings-demo-state';
import { AccountSettingsCard } from './account-settings-card';
import { getAppVersion } from './app-version';
import { TimeZonePicker } from './time-zone-picker';

interface SettingsStatePanelProps {
  account?: AccountProfileState;
  notificationPermissions?: NotificationPermissionGateway;
  onAccountCancelEmailChange?: () => Promise<AccountProfileResult>;
  onAccountConfirmEmailChange?: (input: { code: string }) => Promise<AccountProfileResult>;
  onAccountStartEmailChange?: (input: { currentPassword: string; email: string }) => Promise<AccountProfileResult>;
  onAccountUpdateDisplayName?: (displayName: string) => Promise<AccountProfileResult>;
  onPlanningSettingsChange?: (input: UpdatePlanningSettingsInput) => Promise<void>;
  onSignIn?: () => void;
  onSignUp?: () => void;
  onTimeZoneChange?: (timeZoneId: string) => Promise<void>;
  onUseDeviceTimeZone?: () => Promise<void>;
  settings: AppSettings;
}

export function SettingsStatePanel({ account = { kind: 'withoutAccount' }, notificationPermissions, onAccountCancelEmailChange, onAccountConfirmEmailChange, onAccountStartEmailChange, onAccountUpdateDisplayName, onPlanningSettingsChange, onSignIn, onSignUp, onTimeZoneChange, onUseDeviceTimeZone, settings }: SettingsStatePanelProps) {
  const appVersion = getAppVersion();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isNotificationPermissionPromptVisible, setIsNotificationPermissionPromptVisible] = useState(false);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<NotificationPermissionStatus>('undetermined');
  const [syncLabel, setSyncLabel] = useState<string>(settingsDemoState.initialSyncLabel);
  const [isTimeZonePickerVisible, setIsTimeZonePickerVisible] = useState(false);
  const [planningSettingsEditorPlacement, setPlanningSettingsEditorPlacement] = useState<'plan' | 'notifications' | null>(null);
  const [isSavingPlanningSettings, setIsSavingPlanningSettings] = useState(false);
  const [planningSettings, setPlanningSettings] = useState<UpdatePlanningSettingsInput>(() => getPlanningSettings(settings));
  const notificationPermissionService = useMemo(
    () => notificationPermissions === undefined ? undefined : createNotificationPermissionService(notificationPermissions),
    [notificationPermissions],
  );

  useEffect(() => {
    if (notificationPermissionService === undefined) return;

    void notificationPermissionService.getStatus().then(setNotificationPermissionStatus);
  }, [notificationPermissionService]);

  const refreshDemoStatus = () => {
    setSyncLabel('синхр. только что');
    setFeedback('Статус обновлён в демо-режиме');
  };
  const selectTimeZone = async (timeZoneId: string) => {
    if (onTimeZoneChange === undefined) return;
    try {
      await onTimeZoneChange(timeZoneId);
      setFeedback('Часовой пояс плана обновлён');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Не удалось обновить часовой пояс');
    }
  };
  const activateDeviceTimeZone = async () => {
    if (onUseDeviceTimeZone === undefined) return;
    try {
      await onUseDeviceTimeZone();
      setFeedback('Используется часовой пояс устройства');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Не удалось переключиться на пояс устройства');
    }
  };
  const savePlanningSettings = async () => {
    if (onPlanningSettingsChange === undefined) return;
    setIsSavingPlanningSettings(true);
    try {
      await onPlanningSettingsChange(planningSettings);
      setPlanningSettingsEditorPlacement(null);
      setFeedback('Параметры плана обновлены');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Не удалось обновить параметры плана');
    } finally {
      setIsSavingPlanningSettings(false);
    }
  };
  const openPlanningSettingsEditor = (placement: 'plan' | 'notifications') => {
    setPlanningSettings(getPlanningSettings(settings));
    setPlanningSettingsEditorPlacement(placement);
    setFeedback(null);
  };
  const requestNotificationPermission = async () => {
    if (notificationPermissionService === undefined) return;

    const nextStatus = await notificationPermissionService.request();
    setNotificationPermissionStatus(nextStatus);
    setIsNotificationPermissionPromptVisible(false);
    setFeedback(nextStatus === 'granted' ? 'Локальные уведомления разрешены' : 'Уведомления не разрешены; планирование продолжит работать');
  };
  const postponeNotificationPermission = () => {
    if (isWebNotificationPermissionGateway(notificationPermissions)) {
      notificationPermissions.setDemoStatus('denied');
      setNotificationPermissionStatus('denied');
    }
    setIsNotificationPermissionPromptVisible(false);
    setFeedback('Уведомления можно включить позже в настройках');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerSurface}>
        <View style={[styles.header, temporaryWebContentStyle()]}>
          <Text style={styles.title}>Настройки</Text>
          <Text style={styles.subtitle}>Состояние сервисов и параметры</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, temporaryWebContentStyle()]}>
        <AccountSettingsCard
          account={account}
          onCancelEmailChange={onAccountCancelEmailChange}
          onConfirmEmailChange={onAccountConfirmEmailChange}
          onSignIn={onSignIn}
          onSignUp={onSignUp}
          onStartEmailChange={onAccountStartEmailChange}
          onUpdateDisplayName={onAccountUpdateDisplayName}
        />
        <SurfaceCard style={styles.microsoftCard} tone="info">
          <View style={styles.microsoftHead}>
            <View style={styles.microsoftIcon}>
              <Text style={styles.microsoftIconLabel}>O</Text>
            </View>
            <View style={styles.grow}>
              <Text style={styles.cardHeading}>Microsoft 365: Не подключён</Text>
              <Text style={styles.cardSubheading}>{settingsDemoState.account} · {syncLabel}</Text>
            </View>
            <StatusPill label={settingsDemoState.connectedLabel} tone="neutral" />
          </View>
          <View style={styles.buttonRow}>
            <View style={styles.actionWrap}>
              <ActionButton label="Обновить сейчас" onPress={refreshDemoStatus} tone="soft" />
            </View>
            <View style={styles.actionWrap}>
              <ActionButton label="Управление" onPress={() => setFeedback('Управление Microsoft 365 доступно в демо-режиме')} tone="secondary" />
            </View>
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.card}>
          <CardTitle action="Изменить" onAction={() => openPlanningSettingsEditor('plan')} title="План дня" />
          <SettingsRow description="Знаменатель загрузки" label="Рабочий диапазон" value={`${settings.workdayStartsAt}–${settings.workdayEndsAt}`} />
          <SettingsRow description="Дела без времени" label="Вечерняя проверка" value={settings.eveningReviewAt} />
          <SettingsRow description={settings.timeZoneMode === 'manual' ? 'Выбран вручную из списка IANA' : 'Определяется автоматически устройством'} label="Часовой пояс" onPress={() => setIsTimeZonePickerVisible(true)} value={settings.timeZoneId} />
          {settings.timeZoneMode === 'manual' ? <View style={styles.deviceTimeZoneAction}><ActionButton label="Использовать пояс устройства" onPress={() => void activateDeviceTimeZone()} tone="soft" /></View> : <Text style={styles.settingDescription}>Сейчас используется пояс устройства: {settings.timeZoneId}</Text>}
          {planningSettingsEditorPlacement === 'plan' ? <PlanningSettingsEditor includePlanFields isSaving={isSavingPlanningSettings} onCancel={() => setPlanningSettingsEditorPlacement(null)} onChange={setPlanningSettings} onSave={() => void savePlanningSettings()} settings={planningSettings} /> : null}
        </SurfaceCard>

        <SurfaceCard style={styles.card}>
          <CardTitle action={notificationPermissionAction(notificationPermissionStatus).label} actionTone={notificationPermissionAction(notificationPermissionStatus).tone} onAction={notificationPermissions === undefined ? undefined : () => setIsNotificationPermissionPromptVisible(true)} title="Уведомления" />
          <SettingsRow description="До задачи или встречи" label="Предварительное" onPress={() => openPlanningSettingsEditor('notifications')} value={`${settings.notificationLeadMinutes} минут`} />
          {planningSettingsEditorPlacement === 'notifications' ? <PlanningSettingsEditor isSaving={isSavingPlanningSettings} onCancel={() => setPlanningSettingsEditorPlacement(null)} onChange={setPlanningSettings} onSave={() => void savePlanningSettings()} settings={planningSettings} /> : null}
          {isNotificationPermissionPromptVisible ? <View style={styles.permissionPrompt}>
            <Text style={styles.settingDescription}>Разрешите локальные напоминания, когда будете готовы. План дня останется доступен в любом случае.</Text>
            <View style={styles.buttonRow}>
              <View style={styles.actionWrap}><ActionButton label="Разрешить уведомления" onPress={() => void requestNotificationPermission()} tone="primary" /></View>
              <View style={styles.actionWrap}><ActionButton label="Не сейчас" onPress={postponeNotificationPermission} tone="secondary" /></View>
            </View>
          </View> : null}
          <View style={styles.warning}>
            <Text style={styles.warningText}>{notificationPermissionStatus === 'denied' ? 'Уведомления не разрешены. Планирование и отметка дел останутся доступными.' : 'Если уведомления будут запрещены, приложение продолжит работать и предложит открыть системные настройки.'}</Text>
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.card}>
          <CardTitle title="Данные на этом устройстве" />
          <Text style={styles.storageDescription}>Проекты, задачи, подзадачи, напоминания, блоки расписания и настройки хранятся только на этом устройстве.</Text>
          <View style={styles.warning}>
            <Text style={styles.warningText}>При удалении приложения или переходе на другое устройство эти данные не восстанавливаются.</Text>
          </View>
          <Text style={styles.storageDescription}>Анонимная учётная запись и история поведения не являются резервной копией и не восстанавливают ваши данные.</Text>
        </SurfaceCard>

        <Text style={styles.footer}>Версия {appVersion} · Часовой пояс плана: {settings.timeZoneId}</Text>
        {feedback === null ? null : <Text accessibilityLiveRegion="polite" style={styles.feedback}>{feedback}</Text>}
      </ScrollView>
      <TimeZonePicker onRequestClose={() => setIsTimeZonePickerVisible(false)} onSelect={(timeZoneId) => void selectTimeZone(timeZoneId)} selectedTimeZoneId={settings.timeZoneId} visible={isTimeZonePickerVisible} />
    </SafeAreaView>
  );
}

function getPlanningSettings(settings: AppSettings): UpdatePlanningSettingsInput {
  return {
    workdayStartsAt: settings.workdayStartsAt,
    workdayEndsAt: settings.workdayEndsAt,
    eveningReviewAt: settings.eveningReviewAt,
    notificationLeadMinutes: settings.notificationLeadMinutes,
  };
}

const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { label: value, value };
});

const notificationLeadOptions = Array.from({ length: 25 }, (_, index) => {
  const value = String(index * 5);
  return { label: `${value} минут`, value };
});

function PlanningSettingsEditor({ includePlanFields = false, isSaving, onCancel, onChange, onSave, settings }: {
  includePlanFields?: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onChange: Dispatch<SetStateAction<UpdatePlanningSettingsInput>>;
  onSave: () => void;
  settings: UpdatePlanningSettingsInput;
}) {
  return <View style={styles.planEditor}>
    <Text style={styles.editorTitle}>{includePlanFields ? 'Параметры плана' : 'Предварительное уведомление'}</Text>
    {includePlanFields ? <>
      <Text style={styles.fieldLabel}>Рабочий диапазон</Text>
      <View style={styles.pickerRow}>
        <View style={styles.pickerColumn}><Text style={styles.fieldHint}>Начало</Text><PlanningValuePicker accessibilityLabel="Начало рабочего дня" onChange={(workdayStartsAt) => onChange((current) => ({ ...current, workdayStartsAt }))} options={timeOptions} title="Начало рабочего дня" value={settings.workdayStartsAt} /></View>
        <View style={styles.pickerColumn}><Text style={styles.fieldHint}>Конец</Text><PlanningValuePicker accessibilityLabel="Конец рабочего дня" onChange={(workdayEndsAt) => onChange((current) => ({ ...current, workdayEndsAt }))} options={timeOptions} title="Конец рабочего дня" value={settings.workdayEndsAt} /></View>
      </View>
      <Text style={styles.fieldLabel}>Вечерняя проверка</Text>
      <PlanningValuePicker accessibilityLabel="Время вечерней проверки" onChange={(eveningReviewAt) => onChange((current) => ({ ...current, eveningReviewAt }))} options={timeOptions} title="Время вечерней проверки" value={settings.eveningReviewAt} />
    </> : null}
    <Text style={styles.fieldLabel}>Предварительное уведомление</Text>
    <PlanningValuePicker accessibilityLabel="Интервал уведомления" onChange={(notificationLeadMinutes) => onChange((current) => ({ ...current, notificationLeadMinutes: Number(notificationLeadMinutes) }))} options={notificationLeadOptions} title="Интервал уведомления" value={String(settings.notificationLeadMinutes)} />
    <View style={styles.buttonRow}>
      <View style={styles.actionWrap}><ActionButton label="Отмена" onPress={onCancel} tone="secondary" /></View>
      <View style={styles.actionWrap}><ActionButton disabled={isSaving} label={includePlanFields ? 'Сохранить параметры плана' : 'Сохранить интервал'} onPress={onSave} tone="primary" /></View>
    </View>
  </View>;
}

function notificationPermissionAction(status: NotificationPermissionStatus): { label: string; tone: 'default' | 'success' } {
  if (status === 'granted') return { label: 'Разрешены', tone: 'success' };
  if (status === 'denied') return { label: 'Не разрешены', tone: 'default' };

  return { label: 'Настроить уведомления', tone: 'default' };
}

function isWebNotificationPermissionGateway(
  gateway: NotificationPermissionGateway | undefined,
): gateway is WebNotificationPermissionGateway {
  return gateway !== undefined && 'setDemoStatus' in gateway;
}

function CardTitle({ action, actionTone = 'default', onAction, title }: {
  action?: string;
  actionTone?: 'default' | 'success';
  onAction?: () => void;
  title: string;
}) {
  return (
    <View style={styles.cardTitleRow}>
      <Text style={styles.cardTitle}>{title}</Text>
      {action === undefined ? null : onAction === undefined ? (
        <Text style={[styles.cardAction, actionTone === 'success' && styles.successText]}>{action}</Text>
      ) : (
        <Pressable accessibilityLabel={action} accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.cardActionButton, pressed && styles.pressed]}>
          <Text style={styles.cardAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function SettingsRow({ danger = false, description, label, onPress, value }: {
  danger?: boolean;
  description: string;
  label: string;
  onPress?: () => void;
  value: string;
}) {
  const content = (
    <>
      <View style={styles.grow}>
        <Text style={[styles.settingLabel, danger && styles.dangerText]}>{label}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <View style={styles.settingValueWrap}>
        <Text style={[styles.settingValue, danger && styles.dangerText]}>{value}</Text>
        <Ionicons color={danger ? designTokens.color.feedback.danger.foreground : designTokens.color.text.tertiary} name="chevron-forward" size={16} />
      </View>
    </>
  );

  if (onPress === undefined) {
    return <View style={styles.settingRow}>{content}</View>;
  }

  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: designTokens.color.surface.canvas,
  },
  headerSurface: {
    backgroundColor: designTokens.color.surface.raised,
    borderBottomColor: designTokens.color.border.subtle,
    borderBottomWidth: 1,
  },
  header: {
    paddingHorizontal: designTokens.space[16],
    paddingVertical: designTokens.space[12],
  },
  title: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.screenTitle,
    fontWeight: designTokens.typography.weight.bold,
    letterSpacing: designTokens.typography.tracking.title,
    lineHeight: designTokens.typography.lineHeight.screenTitle,
  },
  subtitle: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
    marginTop: designTokens.space[2],
  },
  content: {
    gap: designTokens.space[10],
    paddingBottom: designTokens.space[24],
    paddingHorizontal: designTokens.space[12],
    paddingTop: designTokens.space[10],
  },
  microsoftCard: {
    padding: designTokens.space[12],
  },
  microsoftHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: designTokens.space[8],
  },
  microsoftIcon: {
    alignItems: 'center',
    backgroundColor: designTokens.color.primary,
    borderRadius: designTokens.radius.row,
    height: designTokens.space[32] + designTokens.space[6],
    justifyContent: 'center',
    width: designTokens.space[32] + designTokens.space[6],
  },
  microsoftIconLabel: {
    color: designTokens.color.text.inverse,
    fontSize: designTokens.typography.size.sectionTitle,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.sectionTitle,
  },
  grow: {
    flex: 1,
  },
  cardHeading: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  cardSubheading: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.micro,
    lineHeight: designTokens.typography.lineHeight.micro,
    marginTop: designTokens.space[2],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: designTokens.space[6],
    marginTop: designTokens.space[10],
  },
  actionWrap: {
    flex: 1,
  },
  card: {
    padding: designTokens.space[12],
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: designTokens.space[4],
  },
  cardTitle: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  cardActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
    paddingHorizontal: designTokens.space[4],
  },
  cardAction: {
    color: designTokens.color.primary,
    fontSize: designTokens.typography.size.meta,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  successText: {
    color: designTokens.color.feedback.success.foreground,
  },
  settingRow: {
    alignItems: 'center',
    borderTopColor: designTokens.color.border.subtle,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: designTokens.space[10],
    minHeight: designTokens.size.touchTargetMin + designTokens.space[4],
    paddingVertical: designTokens.space[8],
  },
  settingLabel: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  settingDescription: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.micro,
    lineHeight: designTokens.typography.lineHeight.micro,
    marginTop: designTokens.space[2],
  },
  settingValueWrap: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  settingValue: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  warning: {
    backgroundColor: designTokens.color.feedback.warning.surface,
    borderRadius: designTokens.radius.row,
    marginTop: designTokens.space[8],
    padding: designTokens.space[10],
  },
  permissionPrompt: {
    borderTopColor: designTokens.color.border.subtle,
    borderTopWidth: 1,
    marginTop: designTokens.space[8],
    paddingTop: designTokens.space[8],
  },
  warningText: {
    color: designTokens.color.feedback.warning.foreground,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  storageDescription: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.meta, lineHeight: designTokens.typography.lineHeight.meta, marginTop: designTokens.space[8] },
  deviceTimeZoneAction: { marginTop: designTokens.space[8] },
  planEditor: { borderTopColor: designTokens.color.border.subtle, borderTopWidth: 1, gap: designTokens.space[8], marginTop: designTokens.space[12], paddingTop: designTokens.space[12] },
  editorTitle: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.bold, lineHeight: designTokens.typography.lineHeight.label },
  fieldLabel: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.meta, fontWeight: designTokens.typography.weight.semibold, lineHeight: designTokens.typography.lineHeight.meta, marginTop: designTokens.space[4] },
  fieldHint: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.micro, lineHeight: designTokens.typography.lineHeight.micro, marginBottom: designTokens.space[4] },
  pickerRow: { flexDirection: 'row', gap: designTokens.space[8] },
  pickerColumn: { flex: 1 },
  dangerText: {
    color: designTokens.color.feedback.danger.foreground,
  },
  footer: {
    color: designTokens.color.text.tertiary,
    fontSize: designTokens.typography.size.micro,
    lineHeight: designTokens.typography.lineHeight.micro,
    paddingHorizontal: designTokens.space[12],
    textAlign: 'center',
  },
  feedback: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
    textAlign: 'center',
  },
  pressed: {
    opacity: designTokens.state.pressedOpacity,
  },
});
