import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppServices } from '../../application/app-services-provider';
import { ScreenShell } from '../screen-shell';

import { CategoryCard } from './category-card';
import { ItemFormSheet, type ItemFormType } from './item-form-sheet';

export type BacklogCategory = 'reminders' | 'unassigned' | 'projects';

interface BacklogRootScreenProps {
  onOpenCategory?: (category: BacklogCategory) => void;
}

export function BacklogRootScreen({ onOpenCategory }: BacklogRootScreenProps) {
  const { backlog, isReady } = useAppServices();
  const [menuVisible, setMenuVisible] = useState(false);
  const [formType, setFormType] = useState<ItemFormType | null>(null);

  const openForm = (type: ItemFormType) => {
    setMenuVisible(false);
    setFormType(type);
  };

  if (!isReady) {
    return <ScreenShell title="Backlog"><Text style={styles.loading}>Загружаем Backlog…</Text></ScreenShell>;
  }

  return (
    <ScreenShell
      title="Backlog"
      headerAction={(
        <Pressable
          accessibilityLabel="Добавить элемент"
          accessibilityRole="button"
          onPress={() => setMenuVisible(true)}
          style={styles.addButton}>
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      )}>
      <View style={styles.cards}>
        <CategoryCard
          count={backlog.reminders.length}
          onPress={() => onOpenCategory?.('reminders')}
          previews={backlog.reminders.map((item) => item.title)}
          title="Напоминания"
        />
        <CategoryCard
          count={backlog.unassignedTasks.length}
          onPress={() => onOpenCategory?.('unassigned')}
          previews={backlog.unassignedTasks.map((item) => item.task.title)}
          title="Без проекта"
        />
        <CategoryCard
          count={backlog.projects.length}
          onPress={() => onOpenCategory?.('projects')}
          previews={backlog.projects.map((item) => item.project.title)}
          title="Проекты"
        />
      </View>
      <Modal animationType="fade" onRequestClose={() => setMenuVisible(false)} transparent visible={menuVisible}>
        <Pressable onPress={() => setMenuVisible(false)} style={styles.menuOverlay}>
          <View style={styles.addMenu}>
            <Text style={styles.menuHeading}>Добавить</Text>
            <Pressable onPress={() => openForm('project')} style={styles.menuAction}><Text style={styles.menuActionText}>Новый проект</Text></Pressable>
            <Pressable onPress={() => openForm('task')} style={styles.menuAction}><Text style={styles.menuActionText}>Новая задача</Text></Pressable>
            <Pressable onPress={() => openForm('reminder')} style={styles.menuAction}><Text style={styles.menuActionText}>Новое напоминание</Text></Pressable>
          </View>
        </Pressable>
      </Modal>
      {formType === null ? null : (
        <ItemFormSheet
          mode="create"
          onClose={() => setFormType(null)}
          type={formType}
          visible
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loading: { color: '#667085', fontSize: 16 },
  addButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#4F46E5' },
  addButtonText: { color: '#FFFFFF', fontSize: 28, fontWeight: '400', lineHeight: 31 },
  cards: { gap: 14 },
  menuOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16, 24, 40, 0.28)', padding: 16 },
  addMenu: { borderRadius: 20, backgroundColor: '#FFFFFF', padding: 18, shadowColor: '#101828', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 4 },
  menuHeading: { marginBottom: 8, color: '#172033', fontSize: 19, fontWeight: '700' },
  menuAction: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#F2F4F7' },
  menuActionText: { color: '#344054', fontSize: 17, fontWeight: '600' },
});
