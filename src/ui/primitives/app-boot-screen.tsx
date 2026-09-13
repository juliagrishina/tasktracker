import { Image, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

export type BootMessage =
  | 'Восстанавливаем доступ'
  | 'Открываем локальную копию'
  | 'Загружаем ваши планы'
  | 'Готово';

interface AppBootScreenProps {
  progress: 15 | 45 | 75 | 100;
  message: BootMessage;
}

export function AppBootScreen({ message, progress }: AppBootScreenProps) {
  return (
    <View style={styles.screen}>
      <Image
        accessibilityLabel="Логотип Plan My Plan"
        source={require('../../../assets/plan-my-plan-512.png')}
        style={styles.logo}
      />
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.percent}>{`${progress}%`}</Text>
      <View
        accessibilityLabel="Прогресс запуска"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: progress }}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: designTokens.color.surface.canvas,
    flex: 1,
    justifyContent: 'center',
    padding: designTokens.space[24],
  },
  logo: {
    borderRadius: 24,
    height: 88,
    marginBottom: designTokens.space[24],
    width: 88,
  },
  message: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.screenTitle,
    fontWeight: '700',
    textAlign: 'center',
  },
  percent: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.body,
    marginBottom: designTokens.space[12],
    marginTop: designTokens.space[8],
  },
  track: {
    backgroundColor: designTokens.color.surface.subtle,
    borderRadius: 999,
    height: 8,
    maxWidth: 320,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    backgroundColor: designTokens.color.primary,
    borderRadius: 999,
    height: '100%',
  },
});
