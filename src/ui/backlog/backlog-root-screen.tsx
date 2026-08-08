import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppServices } from '../../application/app-services-provider';
import { designTokens } from '../design/tokens';
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
          kind="reminders"
          title="Напоминания"
        />
        <CategoryCard
          count={backlog.unassignedTasks.length}
          onPress={() => onOpenCategory?.('unassigned')}
          previews={backlog.unassignedTasks.map((item) => item.task.title)}
          kind="unassigned"
          title="Без проекта"
        />
        <CategoryCard
          count={backlog.projects.length}
          onPress={() => onOpenCategory?.('projects')}
          previews={backlog.projects.map((item) => item.project.title)}
          kind="projects"
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
  loading: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.body },
  addButton: {
    width: designTokens.size.floatingAction,
    height: designTokens.size.floatingAction,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designTokens.radius.pill,
    backgroundColor: designTokens.color.primary,
    ...designTokens.elevation.floatingAction,
  },
  addButtonText: {
    color: designTokens.color.text.inverse,
    fontSize: designTokens.typography.size.display,
    fontWeight: designTokens.typography.weight.regular,
    lineHeight: designTokens.typography.lineHeight.display,
  },
  cards: { gap: designTokens.space[10] },
  menuOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: designTokens.color.overlay.scrim,
    padding: designTokens.space[16],
  },
  addMenu: {
    borderRadius: designTokens.radius.sheet,
    backgroundColor: designTokens.color.surface.raised,
    padding: designTokens.space[16],
    ...designTokens.elevation.card,
  },
  menuHeading: {
    marginBottom: designTokens.space[8],
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.sectionTitle,
    lineHeight: designTokens.typography.lineHeight.sectionTitle,
    fontWeight: designTokens.typography.weight.bold,
  },
  menuAction: {
    minHeight: designTokens.size.touchTargetMin,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: designTokens.color.border.subtle,
  },
  menuActionText: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
    fontWeight: designTokens.typography.weight.semibold,
  },
});
