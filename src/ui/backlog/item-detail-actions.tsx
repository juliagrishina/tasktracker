import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppServices } from '../../application/app-services-provider';
import type { BacklogItemKind } from '../../application/backlog-types';
import { designTokens } from '../design/tokens';
import { ActionButton } from '../primitives/action-button';

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
      <ActionButton disabled={isBusy} label="Редактировать" onPress={onEdit ?? (() => undefined)} tone="secondary" />
      {kind === 'task' && onAddSubtask !== undefined ? (
        <ActionButton disabled={isBusy} label="Добавить подзадачу" onPress={onAddSubtask} tone="secondary" />
      ) : null}
      {kind === 'task' || kind === 'subtask' || kind === 'reminder' ? (
        <ActionButton
          disabled={isBusy}
          label="Запланировать"
          onPress={onEdit ?? (() => undefined)}
          tone="soft"
        />
      ) : null}
      <ActionButton disabled={isBusy} label="Завершить" onPress={complete} tone="primary" />
      <ActionButton disabled={isBusy} label="Удалить" onPress={remove} tone="danger" />
      {message === null ? null : <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: designTokens.space[10], marginTop: designTokens.space[24] },
  message: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
    textAlign: 'center',
  },
});
