import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppServices } from '../application/app-services-provider';

export function DevelopmentStorageDiagnostic() {
  const { runStorageDiagnostic } = useAppServices();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const status = await runStorageDiagnostic();
      setResult(
        status === 'created'
          ? 'Тестовые данные созданы'
          : 'Локальное хранение подтверждено',
      );
    } catch {
      setResult('Не удалось выполнить проверку хранения');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Проверка локального хранения</Text>
      <Text style={styles.description}>
        Доступно только в режиме разработки. Не изменяет пользовательские данные.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Проверить локальное хранение"
        disabled={isRunning}
        onPress={() => void runDiagnostic()}
        style={({ pressed }) => [
          styles.button,
          isRunning && styles.buttonDisabled,
          pressed && !isRunning && styles.buttonPressed,
        ]}>
        <Text style={styles.buttonText}>
          {isRunning ? 'Проверяем…' : 'Проверить хранение'}
        </Text>
      </Pressable>
      {result === null ? null : <Text style={styles.result}>{result}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    padding: 16,
  },
  title: {
    color: '#312E81',
    fontSize: 16,
    fontWeight: '700',
  },
  description: {
    marginTop: 8,
    color: '#4338CA',
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonPressed: {
    backgroundColor: '#3730A3',
  },
  buttonDisabled: {
    backgroundColor: '#A5B4FC',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  result: {
    marginTop: 12,
    color: '#312E81',
    fontSize: 14,
    fontWeight: '600',
  },
});
