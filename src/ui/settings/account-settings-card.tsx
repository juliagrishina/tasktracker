import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { AccountProfileResult, AccountProfileState } from '../../application/account-profile';
import type { PasswordManagementResult } from '../../application/password-management';
import { designTokens } from '../design/tokens';
import { ActionButton } from '../primitives/action-button';
import { SurfaceCard } from '../primitives/surface-card';

interface AccountSettingsCardProps {
  account: AccountProfileState;
  onUpdateDisplayName?: (displayName: string) => Promise<AccountProfileResult>;
  onStartEmailChange?: (input: { currentPassword: string; email: string }) => Promise<AccountProfileResult>;
  onConfirmEmailChange?: (input: { code: string }) => Promise<AccountProfileResult>;
  onCancelEmailChange?: () => Promise<AccountProfileResult>;
  onRequestPasswordChangeCode?: () => Promise<PasswordManagementResult>;
  onChangePassword?: (input: { currentPassword: string; code: string; password: string; passwordConfirmation: string }) => Promise<PasswordManagementResult>;
  onSignIn?: () => void;
  onSignUp?: () => void;
}

export function AccountSettingsCard({
  account,
  onUpdateDisplayName,
  onStartEmailChange,
  onConfirmEmailChange,
  onCancelEmailChange,
  onRequestPasswordChangeCode,
  onChangePassword,
  onSignIn,
  onSignUp,
}: AccountSettingsCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeCodeRequested, setPasswordChangeCodeRequested] = useState(false);
  const [displayName, setDisplayName] = useState(account.kind === 'authenticated' ? account.displayName : '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [passwordChangeCurrentPassword, setPasswordChangeCurrentPassword] = useState('');
  const [passwordChangeCode, setPasswordChangeCode] = useState('');
  const [passwordChangePassword, setPasswordChangePassword] = useState('');
  const [passwordChangeConfirmation, setPasswordChangeConfirmation] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleResult = (result: AccountProfileResult): void => {
    if (result.kind === 'requestFailed' || result.kind === 'validationError') {
      setFeedback(result.message);
      return;
    }
    if (result.kind === 'displayNameUpdated') {
      setDisplayName(result.displayName);
      setFeedback('Имя сохранено.');
    }
    if (result.kind === 'pendingEmailChange') {
      setCurrentPassword('');
      setFeedback(`Код отправлен на ${result.email}.`);
    }
    if (result.kind === 'emailChanged') {
      setCode('');
      setFeedback('Новый email подтверждён.');
    }
    if (result.kind === 'emailChangeCancelled') {
      setCode('');
      setFeedback('Смена email отменена.');
    }
  };

  const handleActionFailure = (): void => {
    setFeedback('Не удалось обновить данные аккаунта. Проверьте подключение к интернету.');
  };

  const handlePasswordResult = (result: PasswordManagementResult): void => {
    switch (result.kind) {
      case 'codeSent':
        setPasswordChangeCodeRequested(true);
        setFeedback('Код отправлен на подтверждённый email.');
        return;
      case 'passwordChanged':
        setPasswordChangeCurrentPassword('');
        setPasswordChangeCode('');
        setPasswordChangePassword('');
        setPasswordChangeConfirmation('');
        setPasswordChangeCodeRequested(false);
        setIsChangingPassword(false);
        setFeedback('Пароль изменён. Остальные устройства вышли из аккаунта.');
        return;
      case 'validationError':
      case 'requestFailed':
        setFeedback(result.message);
        return;
      case 'resendCooldown':
        setFeedback('Новый код можно запросить через минуту.');
        return;
      case 'missingCodeRequest':
        setFeedback('Сначала отправьте код на подтверждённый email.');
        return;
      case 'expiredCode':
        setFeedback('Срок действия кода истёк. Отправьте новый код.');
        return;
      case 'codeInvalidated':
        setFeedback('Код аннулирован. Отправьте новый код.');
        return;
      case 'incorrectCode':
        setFeedback(`Неверный код. Осталось попыток: ${result.attemptsRemaining}.`);
    }
  };

  if (account.kind === 'withoutAccount') {
    return (
      <SurfaceCard style={styles.card} tone="info">
        <Text style={styles.heading}>Аккаунт</Text>
        <Text style={styles.primaryValue}>Без аккаунта</Text>
        <Text style={styles.description}>Войдите или создайте аккаунт, чтобы хранить и синхронизировать планы между устройствами.</Text>
        <View style={styles.actions}>
          <ActionButton label="Войти" onPress={onSignIn ?? (() => {})} tone="primary" />
          <ActionButton label="Создать аккаунт" onPress={onSignUp ?? (() => {})} tone="soft" />
        </View>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard style={styles.card} tone="info">
      <View style={styles.titleRow}>
        <Text style={styles.heading}>Аккаунт</Text>
        <ActionButton label="Редактировать аккаунт" onPress={() => {
          setDisplayName(account.displayName);
          setFeedback(null);
          setIsEditing((value) => !value);
        }} tone="soft" />
      </View>
      <Text style={styles.primaryValue}>{account.displayName}</Text>
      <Text style={styles.description}>{account.email}</Text>
      <Text style={styles.confirmed}>{account.emailConfirmed ? 'Почта подтверждена' : 'Почта ожидает подтверждения'}</Text>
      <ActionButton label="Изменить пароль" onPress={() => {
        setFeedback(null);
        setIsChangingPassword((value) => {
          if (value) setPasswordChangeCodeRequested(false);
          return !value;
        });
      }} tone="soft" />

      {isEditing ? <View style={styles.editor}>
        <Text style={styles.fieldLabel}>Имя</Text>
        <TextInput accessibilityLabel="Имя аккаунта" onChangeText={setDisplayName} style={styles.input} value={displayName} />
        <ActionButton label="Сохранить имя" onPress={() => {
          if (onUpdateDisplayName !== undefined) void onUpdateDisplayName(displayName).then(handleResult).catch(handleActionFailure);
        }} tone="secondary" />

        <Text style={styles.fieldLabel}>Новый email</Text>
        <TextInput accessibilityLabel="Текущий пароль для смены email" autoComplete="current-password" onChangeText={setCurrentPassword} secureTextEntry style={styles.input} textContentType="password" value={currentPassword} />
        <TextInput accessibilityLabel="Новый email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setNewEmail} style={styles.input} textContentType="emailAddress" value={newEmail} />
        <ActionButton label="Отправить код на новый email" onPress={() => {
          if (onStartEmailChange !== undefined) void onStartEmailChange({ currentPassword, email: newEmail }).then(handleResult).catch(handleActionFailure);
        }} tone="primary" />
      </View> : null}

      {account.pendingEmail !== null ? <View style={styles.pending}>
        <Text style={styles.pendingLabel}>Ожидает подтверждения: {account.pendingEmail}</Text>
        <TextInput accessibilityLabel="Код подтверждения нового email" keyboardType="number-pad" maxLength={6} onChangeText={setCode} style={styles.input} value={code} />
        <ActionButton label="Подтвердить новый email" onPress={() => {
          if (onConfirmEmailChange !== undefined) void onConfirmEmailChange({ code }).then(handleResult).catch(handleActionFailure);
        }} tone="primary" />
        <ActionButton label="Отменить смену email" onPress={() => {
          if (onCancelEmailChange !== undefined) void onCancelEmailChange().then(handleResult).catch(handleActionFailure);
        }} tone="secondary" />
      </View> : null}
      {isChangingPassword ? <View style={styles.editor}>
        <Text style={styles.fieldLabel}>Смена пароля</Text>
        <TextInput accessibilityLabel="Текущий пароль" autoComplete="current-password" onChangeText={setPasswordChangeCurrentPassword} secureTextEntry style={styles.input} textContentType="password" value={passwordChangeCurrentPassword} />
        <ActionButton label={passwordChangeCodeRequested ? 'Отправить новый код' : 'Отправить код для смены пароля'} onPress={() => {
          if (onRequestPasswordChangeCode !== undefined) void onRequestPasswordChangeCode().then(handlePasswordResult).catch(handleActionFailure);
        }} tone="secondary" />
        <TextInput accessibilityLabel="Код для смены пароля" autoComplete="one-time-code" keyboardType="number-pad" maxLength={6} onChangeText={setPasswordChangeCode} style={styles.input} textContentType="oneTimeCode" value={passwordChangeCode} />
        <TextInput accessibilityLabel="Новый пароль" autoCapitalize="none" autoComplete="new-password" onChangeText={setPasswordChangePassword} secureTextEntry style={styles.input} textContentType="newPassword" value={passwordChangePassword} />
        <TextInput accessibilityLabel="Повторите новый пароль" autoCapitalize="none" autoComplete="new-password" onChangeText={setPasswordChangeConfirmation} secureTextEntry style={styles.input} textContentType="newPassword" value={passwordChangeConfirmation} />
        <ActionButton label="Сохранить новый пароль" onPress={() => {
          if (onChangePassword !== undefined) void onChangePassword({
            currentPassword: passwordChangeCurrentPassword,
            code: passwordChangeCode,
            password: passwordChangePassword,
            passwordConfirmation: passwordChangeConfirmation,
          }).then(handlePasswordResult).catch(handleActionFailure);
        }} tone="primary" />
      </View> : null}
      {feedback === null ? null : <Text accessibilityLiveRegion="polite" style={styles.feedback}>{feedback}</Text>}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: designTokens.space[8] },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: designTokens.space[8], justifyContent: 'space-between' },
  heading: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.sectionTitle, fontWeight: designTokens.typography.weight.bold },
  primaryValue: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.body, fontWeight: designTokens.typography.weight.semibold },
  description: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.label, lineHeight: designTokens.typography.lineHeight.label },
  confirmed: { color: designTokens.color.feedback.success.foreground, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.semibold },
  actions: { gap: designTokens.space[8] },
  editor: { gap: designTokens.space[8], marginTop: designTokens.space[8] },
  pending: { gap: designTokens.space[8], marginTop: designTokens.space[8], paddingTop: designTokens.space[8], borderTopColor: designTokens.color.border.info, borderTopWidth: 1 },
  pendingLabel: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.semibold },
  fieldLabel: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.semibold },
  input: { backgroundColor: designTokens.color.surface.raised, borderColor: designTokens.color.border.subtle, borderRadius: designTokens.radius.control, borderWidth: 1, color: designTokens.color.text.primary, fontSize: designTokens.typography.size.body, minHeight: designTokens.size.touchTargetMin, paddingHorizontal: designTokens.space[12] },
  feedback: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.label, lineHeight: designTokens.typography.lineHeight.label },
});
