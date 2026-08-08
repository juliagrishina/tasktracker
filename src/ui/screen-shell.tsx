import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { designTokens } from './design/tokens';

interface ScreenShellProps {
  title: string;
  children: ReactNode;
  headerAction?: ReactNode;
  onBack?: () => void;
  subtitle?: string;
}

export function ScreenShell({ title, children, headerAction, onBack, subtitle }: ScreenShellProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {onBack === undefined ? null : (
          <Pressable accessibilityLabel="Назад" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>‹ Назад</Text>
          </Pressable>
        )}
        <View style={styles.header}>
          <View style={styles.titleStack}>
            <Text style={styles.title}>{title}</Text>
            {subtitle === undefined ? null : <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {headerAction}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: designTokens.color.surface.canvas,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: designTokens.space[16],
    paddingVertical: designTokens.space[20],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: designTokens.space[20],
  },
  titleStack: {
    flex: 1,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: designTokens.size.touchTargetMin,
    justifyContent: 'center',
    paddingRight: designTokens.space[8],
    marginBottom: designTokens.space[4],
  },
  backText: {
    color: designTokens.color.primaryStrong,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
    fontWeight: designTokens.typography.weight.semibold,
  },
  title: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.screenTitle,
    lineHeight: designTokens.typography.lineHeight.screenTitle,
    fontWeight: designTokens.typography.weight.bold,
    letterSpacing: designTokens.typography.tracking.title,
  },
  subtitle: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
    marginTop: designTokens.space[2],
  },
});
