import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { designTokens } from '../design/tokens';
import { ActionButton } from '../primitives/action-button';

type AuthMode = 'registration' | 'login';

export interface AuthScreenProps {
  onContinueWithoutAccount: () => void;
  onForgotPassword?: () => void;
  onSignIn?: (input: { email: string; password: string }) => void;
  onSignUp?: (input: { displayName: string; email: string; password: string; passwordConfirmation: string; termsAccepted: boolean }) => void;
}

export function AuthScreen({
  onContinueWithoutAccount,
  onForgotPassword = () => {},
  onSignIn = () => {},
  onSignUp = () => {},
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('registration');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const isRegistration = mode === 'registration';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic">
          <View style={styles.card}>
            <View style={styles.brandMark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={styles.brandMarkText}>P</Text>
            </View>
            <Text accessibilityRole="header" style={styles.title}>Plan My Plan</Text>
            <Text style={styles.subtitle}>
              {isRegistration
                ? 'Создайте аккаунт, чтобы сохранить планы между устройствами.'
                : 'Войдите, чтобы продолжить работу со своими планами.'}
            </Text>

            {isRegistration ? (
              <TextInput
                accessibilityLabel="Имя"
                autoCapitalize="words"
                autoComplete="name"
                onChangeText={setDisplayName}
                placeholder="Имя"
                placeholderTextColor={designTokens.color.text.tertiary}
                style={styles.input}
                textContentType="name"
                value={displayName}
              />
            ) : null}
            <TextInput
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={designTokens.color.text.tertiary}
              style={styles.input}
              textContentType="emailAddress"
              value={email}
            />
            <TextInput
              accessibilityLabel="Пароль"
              autoCapitalize="none"
              autoComplete={isRegistration ? 'new-password' : 'current-password'}
              onChangeText={setPassword}
              placeholder="Пароль"
              placeholderTextColor={designTokens.color.text.tertiary}
              secureTextEntry
              style={styles.input}
              textContentType={isRegistration ? 'newPassword' : 'password'}
              value={password}
            />
            {isRegistration ? (
              <>
                <TextInput
                  accessibilityLabel="Повторите пароль"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  onChangeText={setPasswordConfirmation}
                  placeholder="Повторите пароль"
                  placeholderTextColor={designTokens.color.text.tertiary}
                  secureTextEntry
                  style={styles.input}
                  textContentType="newPassword"
                  value={passwordConfirmation}
                />
                <Pressable
                  accessibilityLabel="Принять Пользовательское соглашение и Политику конфиденциальности"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: termsAccepted }}
                  hitSlop={8}
                  onPress={() => setTermsAccepted((accepted) => !accepted)}
                  style={styles.termsRow}>
                  <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                    {termsAccepted ? <Ionicons color={designTokens.color.text.inverse} name="checkmark" size={16} /> : null}
                  </View>
                  <Text style={styles.termsText}>
                    Принимаю Пользовательское соглашение и Политику конфиденциальности
                  </Text>
                </Pressable>
              </>
            ) : null}

            <ActionButton
              label={isRegistration ? 'Создать аккаунт' : 'Войти'}
              onPress={() => {
                if (isRegistration) {
                  onSignUp({ displayName, email, password, passwordConfirmation, termsAccepted });
                  return;
                }
                onSignIn({ email, password });
              }}
              tone="primary"
            />

            {isRegistration ? (
              <Pressable accessibilityLabel="Перейти ко входу" onPress={() => setMode('login')} style={styles.textAction}>
                <Text style={styles.textActionLabel}>Уже есть аккаунт? Войти</Text>
              </Pressable>
            ) : (
              <>
                <Pressable accessibilityLabel="Забыли пароль?" onPress={onForgotPassword} style={styles.textAction}>
                  <Text style={styles.textActionLabel}>Забыли пароль?</Text>
                </Pressable>
                <Pressable accessibilityLabel="Перейти к регистрации" onPress={() => setMode('registration')} style={styles.textAction}>
                  <Text style={styles.textActionLabel}>Нет аккаунта? Зарегистрироваться</Text>
                </Pressable>
              </>
            )}

            <View style={styles.separator} />
            <ActionButton label="Продолжить без аккаунта" onPress={onContinueWithoutAccount} tone="soft" />
            <Text style={styles.offlineHint}>Планы останутся на этом устройстве.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: designTokens.color.surface.canvas,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: designTokens.space[20],
  },
  card: {
    width: '100%',
    maxWidth: 440,
    gap: designTokens.space[12],
  },
  brandMark: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: designTokens.radius.card,
    backgroundColor: designTokens.color.primary,
    marginBottom: designTokens.space[8],
  },
  brandMarkText: {
    color: designTokens.color.text.inverse,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: designTokens.typography.weight.bold,
  },
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
    marginBottom: designTokens.space[8],
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
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: designTokens.space[8],
    paddingVertical: designTokens.space[4],
  },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: designTokens.color.border.subtle,
    borderRadius: designTokens.radius.compact,
    backgroundColor: designTokens.color.surface.raised,
  },
  checkboxChecked: {
    borderColor: designTokens.color.primary,
    backgroundColor: designTokens.color.primary,
  },
  termsText: {
    flex: 1,
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
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
  separator: {
    height: 1,
    backgroundColor: designTokens.color.border.subtle,
    marginVertical: designTokens.space[4],
  },
  offlineHint: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
    textAlign: 'center',
  },
});
