import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { maskEmail } from '../../domain/account-auth-validation';
import { designTokens } from '../design/tokens';
import { ActionButton } from '../primitives/action-button';

export interface EmailVerificationScreenProps {
  email: string;
  resendAvailableAtMs: number;
  requiresPassword: boolean;
  errorMessage?: string | null;
  infoMessage?: string | null;
  onConfirm: (input: { code: string; password: string; passwordConfirmation: string }) => void;
  onResend: () => void;
  onChangeEmail: () => void;
  onContinueLocally: () => void;
}

export function EmailVerificationScreen({
  email,
  resendAvailableAtMs,
  requiresPassword,
  errorMessage = null,
  infoMessage = null,
  onConfirm,
  onResend,
  onChangeEmail,
  onContinueLocally,
}: EmailVerificationScreenProps) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const secondsUntilResend = Math.max(0, Math.ceil((resendAvailableAtMs - now) / 1_000));

  useEffect(() => {
    if (secondsUntilResend === 0) {
      return undefined;
    }
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [secondsUntilResend]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidingView}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.title}>Подтвердите email</Text>
            <Text style={styles.subtitle}>
              Мы отправили шестизначный код на {maskEmail(email)}. Код действует 10 минут.
            </Text>
            {requiresPassword ? (
              <Text style={styles.restartHint}>
                Для завершения регистрации после перезапуска введите новый пароль ещё раз.
              </Text>
            ) : null}
            {errorMessage !== null ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
            {infoMessage !== null ? <Text style={styles.info}>{infoMessage}</Text> : null}
            <TextInput
              accessibilityLabel="Код подтверждения"
              autoComplete="one-time-code"
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) => setCode(value.replace(/\D/gu, ''))}
              placeholder="000000"
              placeholderTextColor={designTokens.color.text.tertiary}
              style={styles.input}
              textContentType="oneTimeCode"
              value={code}
            />
            {requiresPassword ? (
              <>
                <TextInput
                  accessibilityLabel="Новый пароль"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  onChangeText={setPassword}
                  placeholder="Новый пароль"
                  placeholderTextColor={designTokens.color.text.tertiary}
                  secureTextEntry
                  style={styles.input}
                  textContentType="newPassword"
                  value={password}
                />
                <TextInput
                  accessibilityLabel="Повторите новый пароль"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  onChangeText={setPasswordConfirmation}
                  placeholder="Повторите новый пароль"
                  placeholderTextColor={designTokens.color.text.tertiary}
                  secureTextEntry
                  style={styles.input}
                  textContentType="newPassword"
                  value={passwordConfirmation}
                />
              </>
            ) : null}
            <ActionButton
              label="Подтвердить"
              onPress={() => onConfirm({ code, password, passwordConfirmation })}
              tone="primary"
            />
            <ActionButton
              disabled={secondsUntilResend > 0}
              label={secondsUntilResend > 0 ? `Отправить код повторно (${secondsUntilResend})` : 'Отправить код повторно'}
              onPress={onResend}
              tone="soft"
            />
            <Pressable accessibilityLabel="Изменить email" onPress={onChangeEmail} style={styles.textAction}>
              <Text style={styles.textActionLabel}>Изменить email</Text>
            </Pressable>
            <Pressable accessibilityLabel="Продолжить локально" onPress={onContinueLocally} style={styles.textAction}>
              <Text style={styles.textActionLabel}>Продолжить локально</Text>
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
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: designTokens.space[20],
  },
  card: { width: '100%', maxWidth: 440, gap: designTokens.space[12] },
  title: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.display,
    lineHeight: designTokens.typography.lineHeight.display,
    fontWeight: designTokens.typography.weight.bold,
    letterSpacing: designTokens.typography.tracking.title,
  },
  subtitle: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
  restartHint: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  input: {
    minHeight: designTokens.size.touchTargetMin,
    borderWidth: 1,
    borderColor: designTokens.color.border.subtle,
    borderRadius: designTokens.radius.control,
    backgroundColor: designTokens.color.surface.raised,
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
    paddingHorizontal: designTokens.space[12],
  },
  error: {
    color: designTokens.color.feedback.danger.foreground,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  info: {
    color: designTokens.color.feedback.success.foreground,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  textAction: {
    alignSelf: 'center',
    minHeight: designTokens.size.touchTargetMin,
    justifyContent: 'center',
    paddingHorizontal: designTokens.space[8],
  },
  textActionLabel: {
    color: designTokens.color.primaryStrong,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
    fontWeight: designTokens.typography.weight.semibold,
  },
});
