import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppSettings } from '../../domain/entities';
import { designTokens } from '../design/tokens';
import { ActionButton } from '../primitives/action-button';
import { StatusPill } from '../primitives/status-pill';
import { SurfaceCard } from '../primitives/surface-card';

import { settingsDemoState } from './settings-demo-state';

interface SettingsStatePanelProps {
  settings: AppSettings;
}

export function SettingsStatePanel({ settings }: SettingsStatePanelProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [syncLabel, setSyncLabel] = useState<string>(settingsDemoState.initialSyncLabel);

  const refreshDemoStatus = () => {
    setSyncLabel('синхр. только что');
    setFeedback('Статус обновлён в демо-режиме');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Настройки</Text>
        <Text style={styles.subtitle}>Состояние сервисов и параметры</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceCard style={styles.microsoftCard} tone="info">
          <View style={styles.microsoftHead}>
            <View style={styles.microsoftIcon}>
              <Text style={styles.microsoftIconLabel}>O</Text>
            </View>
            <View style={styles.grow}>
              <Text style={styles.cardHeading}>Microsoft 365</Text>
              <Text style={styles.cardSubheading}>{settingsDemoState.account} · {syncLabel}</Text>
            </View>
            <StatusPill label={settingsDemoState.connectedLabel} tone="success" />
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
          <CardTitle action="Изменить" onAction={() => setFeedback('Параметры плана доступны для просмотра в демо-режиме')} title="План дня" />
          <SettingsRow description="Знаменатель загрузки" label="Рабочий диапазон" value={`${settings.workdayStartsAt}–${settings.workdayEndsAt}`} />
          <SettingsRow description="Дела без времени" label="Вечерняя проверка" value={settings.eveningReviewAt} />
        </SurfaceCard>

        <SurfaceCard style={styles.card}>
          <CardTitle action="Разрешены" actionTone="success" title="Уведомления" />
          <SettingsRow description="До задачи или встречи" label="Предварительное" value={`${settings.notificationLeadMinutes} минут`} />
          <View style={styles.warning}>
            <Text style={styles.warningText}>Если уведомления будут запрещены, приложение продолжит работать и предложит открыть системные настройки.</Text>
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.card}>
          <CardTitle title="Данные Outlook" />
          <SettingsRow
            danger
            description="Не отключает корпоративную учётную запись"
            label="Удалить локальные данные"
            onPress={() => setFeedback('Удаление локальных данных недоступно в демо-режиме')}
            value="Удалить"
          />
        </SurfaceCard>

        <Text style={styles.footer}>{settingsDemoState.version} · Часовой пояс определяется устройством</Text>
        {feedback === null ? null : <Text accessibilityLiveRegion="polite" style={styles.feedback}>{feedback}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
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
  header: {
    backgroundColor: designTokens.color.surface.raised,
    borderBottomColor: designTokens.color.border.subtle,
    borderBottomWidth: 1,
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
  warningText: {
    color: designTokens.color.feedback.warning.foreground,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
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
