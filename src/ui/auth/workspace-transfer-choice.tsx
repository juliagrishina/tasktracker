import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';
import { ActionButton } from '../primitives/action-button';

export interface WorkspaceTransferChoiceProps {
  errorMessage?: string | null;
  onMerge: () => void;
  onKeepSeparate: () => void;
}

export function WorkspaceTransferChoice({
  errorMessage = null,
  onMerge,
  onKeepSeparate,
}: WorkspaceTransferChoiceProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Как поступить с данными на этом устройстве?
        </Text>
        <Text style={styles.description}>
          Здесь есть планы, созданные без аккаунта. Выберите, нужно ли добавить их к данным аккаунта.
        </Text>
        {errorMessage !== null ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
        <View style={styles.actions}>
          <ActionButton
            label="Объединить с данными аккаунта"
            onPress={onMerge}
            tone="primary"
          />
          <Text style={styles.hint}>
            Планы с этого устройства будут скопированы в локальную область аккаунта. Исходные данные сохранятся.
          </Text>
          <ActionButton
            label="Не переносить"
            onPress={onKeepSeparate}
            tone="soft"
          />
          <Text style={styles.hint}>
            Откроется пустая локальная область аккаунта. Автономные планы останутся отдельно.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: designTokens.color.surface.canvas,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: designTokens.space[12],
    padding: designTokens.space[20],
  },
  title: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.screenTitle,
    lineHeight: designTokens.typography.lineHeight.screenTitle,
    fontWeight: designTokens.typography.weight.bold,
    letterSpacing: designTokens.typography.tracking.title,
  },
  description: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
  actions: {
    gap: designTokens.space[8],
    marginTop: designTokens.space[8],
  },
  hint: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
    marginBottom: designTokens.space[8],
  },
  error: {
    color: designTokens.color.feedback.danger.foreground,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
  },
});
