import { Alert, Platform } from 'react-native';

export function confirmBacklogDeletion(): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm('Удалить этот элемент без возможности восстановления?'));
  }

  return new Promise((resolve) => {
    Alert.alert(
      'Удалить элемент?',
      'Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Удалить', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
