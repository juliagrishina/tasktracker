import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { maskEmail } from '../../domain/account-auth-validation';
import { designTokens } from '../design/tokens';
import { ActionButton } from '../primitives/action-button';

export interface PasswordRecoveryScreenProps {
  email: string | null;
  errorMessage?: string | null;
  infoMessage?: string | null;
  onRequest: (input: { email: string }) => void;
  onConfirm: (input: { email: string; code: string; password: string; passwordConfirmation: string }) => void;
  onResend: () => void;
  onBack: () => void;
}

export function PasswordRecoveryScreen({
  email,
  errorMessage = null,
  infoMessage = null,
  onRequest,
  onConfirm,
  onResend,
  onBack,
}: PasswordRecoveryScreenProps) {
  const [requestEmail, setRequestEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  const isConfirming = email !== null;
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidingView}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.title}>{isConfirming ? 'Восстановление пароля' : 'Забыли пароль?'}</Text>
            <Text style={styles.subtitle}>
              {isConfirming
                ? `Если такой аккаунт существует, мы отправили шестизначный код на ${maskEmail(email)}.`
                : 'Введите email. Если такой аккаунт существует, мы отправим шестизначный код для восстановления.'}
            </Text>
            {errorMessage === null ? null : <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text>}
            {infoMessage === null ? null : <Text style={styles.info}>{infoMessage}</Text>}
            {isConfirming ? <>
              <TextInput accessibilityLabel="Код восстановления" autoComplete="one-time-code" keyboardType="number-pad" maxLength={6} onChangeText={(value) => setCode(value.replace(/\D/gu, ''))} placeholder="000000" placeholderTextColor={designTokens.color.text.tertiary} style={styles.input} textContentType="oneTimeCode" value={code} />
              <TextInput accessibilityLabel="Новый пароль" autoCapitalize="none" autoComplete="new-password" onChangeText={setPassword} placeholder="Новый пароль" placeholderTextColor={designTokens.color.text.tertiary} secureTextEntry style={styles.input} textContentType="newPassword" value={password} />
              <TextInput accessibilityLabel="Повторите новый пароль" autoCapitalize="none" autoComplete="new-password" onChangeText={setPasswordConfirmation} placeholder="Повторите новый пароль" placeholderTextColor={designTokens.color.text.tertiary} secureTextEntry style={styles.input} textContentType="newPassword" value={passwordConfirmation} />
              <ActionButton label="Сохранить новый пароль" onPress={() => onConfirm({ email, code, password, passwordConfirmation })} tone="primary" />
              <ActionButton label="Отправить код повторно" onPress={onResend} tone="soft" />
            </> : <>
              <TextInput accessibilityLabel="Email для восстановления" autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setRequestEmail} placeholder="Email" placeholderTextColor={designTokens.color.text.tertiary} style={styles.input} textContentType="emailAddress" value={requestEmail} />
              <ActionButton label="Отправить код" onPress={() => onRequest({ email: requestEmail })} tone="primary" />
            </>}
            <Pressable accessibilityLabel="Вернуться ко входу" onPress={onBack} style={styles.textAction}>
              <Text style={styles.textActionLabel}>Вернуться ко входу</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: designTokens.color.surface.canvas },
  keyboardAvoidingView: { flex: 1 },
  content: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', padding: designTokens.space[20] },
  card: { gap: designTokens.space[12], maxWidth: 440, width: '100%' },
  title: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.display, fontWeight: designTokens.typography.weight.bold, lineHeight: designTokens.typography.lineHeight.display },
  subtitle: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.body, lineHeight: designTokens.typography.lineHeight.body },
  input: { backgroundColor: designTokens.color.surface.raised, borderColor: designTokens.color.border.subtle, borderRadius: designTokens.radius.control, borderWidth: 1, color: designTokens.color.text.primary, fontSize: designTokens.typography.size.body, minHeight: designTokens.size.touchTargetMin, paddingHorizontal: designTokens.space[12] },
  error: { color: designTokens.color.feedback.danger.foreground, fontSize: designTokens.typography.size.label, lineHeight: designTokens.typography.lineHeight.label },
  info: { color: designTokens.color.feedback.success.foreground, fontSize: designTokens.typography.size.label, lineHeight: designTokens.typography.lineHeight.label },
  textAction: { alignSelf: 'center', justifyContent: 'center', minHeight: designTokens.size.touchTargetMin, paddingHorizontal: designTokens.space[8] },
  textActionLabel: { color: designTokens.color.primaryStrong, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.semibold, lineHeight: designTokens.typography.lineHeight.label },
});
