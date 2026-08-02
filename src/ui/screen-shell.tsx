import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenShellProps {
  title: string;
  children: ReactNode;
  headerAction?: ReactNode;
  onBack?: () => void;
}

export function ScreenShell({ title, children, headerAction, onBack }: ScreenShellProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {onBack === undefined ? null : (
          <Pressable accessibilityLabel="Назад" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>‹ Назад</Text>
          </Pressable>
        )}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
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
    backgroundColor: '#F7F8FA',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
    marginBottom: 6,
  },
  backText: {
    color: '#4F46E5',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#172033',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
});
