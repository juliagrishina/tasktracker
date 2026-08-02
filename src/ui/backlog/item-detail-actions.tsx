import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppServices } from '../../application/app-services-provider';
import type { BacklogItemKind } from '../../application/backlog-types';

import { confirmBacklogDeletion } from './confirmation';

interface ItemDetailActionsProps {
  id: string;
  kind: BacklogItemKind;
  confirmDelete?: () => Promise<boolean>;
  onEdit?: () => void;
  onAddSubtask?: () => void;
  onCompleted?: () => void;
  onDeleted?: () => void;
}

export function ItemDetailActions({
  id,
  kind,
  confirmDelete = confirmBacklogDeletion,
  onEdit,
  onAddSubtask,
  onCompleted,
  onDeleted,
}: ItemDetailActionsProps) {
  const { backlogActions } = useAppServices();
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setMessage(null);
    setIsBusy(true);

    try {
      await action();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : 'Не удалось выполнить действие');
    } finally {
      setIsBusy(false);
    }
  };

  const complete = () => void run(async () => {
    await backlogActions.completeItem({ kind, id, completedAt: new Date().toISOString() });
    setMessage('Завершено');
    onCompleted?.();
  });

  const remove = () => void run(async () => {
    if (!(await confirmDelete())) {
      return;
    }

    await backlogActions.deleteItem({ kind, id, confirmed: true });
    onDeleted?.();
  });

  return (
    <View style={styles.container}>
      <Pressable disabled={isBusy} onPress={onEdit} style={styles.secondaryAction}>
        <Text style={styles.secondaryText}>Редактировать</Text>
      </Pressable>
      {kind === 'task' && onAddSubtask !== undefined ? (
        <Pressable disabled={isBusy} onPress={onAddSubtask} style={styles.secondaryAction}>
          <Text style={styles.secondaryText}>Добавить подзадачу</Text>
        </Pressable>
      ) : null}
      {kind === 'task' || kind === 'subtask' ? (
        <Pressable
          disabled={isBusy}
          onPress={() => setMessage('Выбор даты и времени появится на следующем этапе планирования')}
          style={styles.secondaryAction}>
          <Text style={styles.secondaryText}>Запланировать</Text>
        </Pressable>
      ) : null}
      <Pressable disabled={isBusy} onPress={complete} style={styles.completeAction}>
        <Text style={styles.completeText}>Завершить</Text>
      </Pressable>
      <Pressable disabled={isBusy} onPress={remove} style={styles.deleteAction}>
        <Text style={styles.deleteText}>Удалить</Text>
      </Pressable>
      {message === null ? null : <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, marginTop: 24 },
  secondaryAction: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12, backgroundColor: '#FFFFFF' },
  secondaryText: { color: '#344054', fontSize: 16, fontWeight: '700' },
  completeAction: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#4F46E5' },
  completeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  deleteAction: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FEF3F2' },
  deleteText: { color: '#B42318', fontSize: 16, fontWeight: '700' },
  message: { color: '#475467', fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
