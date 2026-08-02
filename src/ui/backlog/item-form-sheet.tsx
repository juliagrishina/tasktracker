import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppServices } from '../../application/app-services-provider';
import type { Project, Reminder, TaskItem } from '../../domain/entities';

export type ItemFormType = 'project' | 'task' | 'subtask' | 'reminder';
export type ItemFormMode = 'create' | 'edit';
type FormItem = Project | TaskItem | Reminder;

interface ItemFormSheetProps {
  visible: boolean;
  mode: ItemFormMode;
  type: ItemFormType;
  onClose: () => void;
  item?: FormItem;
  parentTaskId?: string;
  projectId?: string | null;
  onSaved?: () => void;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function createItemId(type: ItemFormType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getInitialProjectId(item: FormItem | undefined, projectId: string | null | undefined): string | null {
  if (item !== undefined && 'projectId' in item) {
    return item.projectId;
  }

  return projectId ?? null;
}

function getInitialDescription(item: FormItem | undefined): string {
  return item !== undefined && 'description' in item ? item.description ?? '' : '';
}

function getInitialDuration(item: FormItem | undefined): string {
  return item !== undefined && 'estimatedDurationMinutes' in item && item.estimatedDurationMinutes !== null
    ? String(item.estimatedDurationMinutes)
    : '';
}

function getInitialReminderValue(item: FormItem | undefined, key: 'remindsOn' | 'periodStartOn' | 'periodEndOn'): string {
  if (item !== undefined && 'remindsOn' in item) {
    return item[key] ?? '';
  }

  return '';
}

function getInitialRepeatFrequency(item: FormItem | undefined): '' | 'daily' | 'weekly' | 'monthly' {
  if (item !== undefined && 'repeatRule' in item && item.repeatRule !== null) {
    return item.repeatRule.frequency;
  }

  return '';
}

function getInitialRepeatInterval(item: FormItem | undefined): string {
  return item !== undefined && 'repeatRule' in item && item.repeatRule !== null
    ? String(item.repeatRule.interval)
    : '1';
}

export function ItemFormSheet({
  visible,
  mode,
  type,
  onClose,
  item,
  parentTaskId,
  projectId,
  onSaved,
}: ItemFormSheetProps) {
  const { backlog, backlogActions } = useAppServices();
  const [title, setTitle] = useState(() => item?.title ?? '');
  const [description, setDescription] = useState(() => getInitialDescription(item));
  const [duration, setDuration] = useState(() => getInitialDuration(item));
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => getInitialProjectId(item, projectId));
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);
  const [remindsOn, setRemindsOn] = useState(() => getInitialReminderValue(item, 'remindsOn'));
  const [periodStartOn, setPeriodStartOn] = useState(() => getInitialReminderValue(item, 'periodStartOn'));
  const [periodEndOn, setPeriodEndOn] = useState(() => getInitialReminderValue(item, 'periodEndOn'));
  const [repeatFrequency, setRepeatFrequency] = useState<'' | 'daily' | 'weekly' | 'monthly'>(() => getInitialRepeatFrequency(item));
  const [repeatInterval, setRepeatInterval] = useState(() => getInitialRepeatInterval(item));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const formTitle = useMemo(() => {
    const createTitle: Record<ItemFormType, string> = {
      project: 'Новый проект',
      task: 'Новая задача',
      subtask: 'Новая подзадача',
      reminder: 'Новое напоминание',
    };

    return mode === 'create' ? createTitle[type] : 'Редактировать';
  }, [mode, type]);

  const submit = async () => {
    setError(null);
    setIsSaving(true);

    try {
      const estimatedDurationMinutes = duration.trim() === '' ? null : Number(duration);
      const now = new Date().toISOString();

      if (type === 'project') {
        if (mode === 'create') {
          await backlogActions.createProject({
            id: createItemId(type),
            title,
            description,
            createdAt: now,
          });
        } else if (item !== undefined) {
          await backlogActions.updateProject({ id: item.id, title, description });
        }
      }

      if (type === 'task') {
        if (mode === 'create') {
          await backlogActions.createTask({
            id: createItemId(type),
            title,
            description,
            projectId: selectedProjectId,
            estimatedDurationMinutes,
            createdAt: now,
          });
        } else if (item !== undefined && 'kind' in item && item.kind === 'task') {
          await backlogActions.updateTaskItem({
            id: item.id,
            title,
            description,
            estimatedDurationMinutes,
          });
          if (item.projectId !== selectedProjectId) {
            await backlogActions.moveTaskToProject({
              taskId: item.id,
              projectId: selectedProjectId,
            });
          }
        }
      }

      if (type === 'subtask') {
        if (mode === 'create') {
          if (parentTaskId === undefined) {
            throw new Error('Не выбрана задача-родитель');
          }
          await backlogActions.createSubtask({
            id: createItemId(type),
            title,
            description,
            parentTaskId,
            estimatedDurationMinutes,
            createdAt: now,
          });
        } else if (item !== undefined && 'kind' in item && item.kind === 'subtask') {
          await backlogActions.updateTaskItem({
            id: item.id,
            title,
            description,
            estimatedDurationMinutes,
          });
        }
      }

      if (type === 'reminder') {
        const repeatRule = repeatFrequency === ''
          ? null
          : { frequency: repeatFrequency, interval: Number(repeatInterval) };
        const reminderInput = {
          title,
          remindsOn: emptyToNull(remindsOn),
          periodStartOn: emptyToNull(periodStartOn),
          periodEndOn: emptyToNull(periodEndOn),
          repeatRule,
          estimatedDurationMinutes,
        };

        if (mode === 'create') {
          await backlogActions.createReminder({
            id: createItemId(type),
            ...reminderInput,
            createdAt: now,
          });
        } else if (item !== undefined) {
          await backlogActions.updateReminder({ id: item.id, ...reminderInput });
        }
      }

      onSaved?.();
      onClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось сохранить изменения');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedProject = backlog.projects.find(
    (entry) => entry.project.id === selectedProjectId,
  )?.project;

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.heading}>{formTitle}</Text>
            <Pressable accessibilityLabel="Закрыть форму" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Название</Text>
            <TextInput
              accessibilityLabel="Название"
              autoFocus
              onChangeText={setTitle}
              placeholder="Например, подготовить документы"
              placeholderTextColor="#98A2B3"
              style={styles.input}
              value={title}
            />
            <Text style={styles.label}>Описание</Text>
            <TextInput
              accessibilityLabel="Описание"
              multiline
              onChangeText={setDescription}
              placeholder="Необязательно"
              placeholderTextColor="#98A2B3"
              style={[styles.input, styles.multilineInput]}
              value={description}
            />
            {type === 'task' ? (
              <View>
                <Text style={styles.label}>Проект</Text>
                <Pressable
                  accessibilityLabel="Выбрать проект"
                  onPress={() => setProjectPickerVisible((current) => !current)}
                  style={styles.selector}>
                  <Text style={styles.selectorText}>{selectedProject?.title ?? 'Без проекта'}</Text>
                  <Text style={styles.selectorChevron}>⌄</Text>
                </Pressable>
                {projectPickerVisible ? (
                  <View style={styles.projectOptions}>
                    <Pressable onPress={() => { setSelectedProjectId(null); setProjectPickerVisible(false); }} style={styles.option}>
                      <Text style={styles.optionText}>Без проекта</Text>
                    </Pressable>
                    {backlog.projects.map(({ project }) => (
                      <Pressable
                        key={project.id}
                        onPress={() => { setSelectedProjectId(project.id); setProjectPickerVisible(false); }}
                        style={styles.option}>
                        <Text style={styles.optionText}>{project.title}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
            {type === 'task' || type === 'subtask' || type === 'reminder' ? (
              <View>
                <Text style={styles.label}>Оценочная длительность, мин.</Text>
                <TextInput
                  accessibilityLabel="Оценочная длительность, мин."
                  keyboardType="number-pad"
                  onChangeText={setDuration}
                  placeholder="Необязательно"
                  placeholderTextColor="#98A2B3"
                  style={styles.input}
                  value={duration}
                />
              </View>
            ) : null}
            {type === 'reminder' ? (
              <View style={styles.reminderFields}>
                <Text style={styles.label}>Дата</Text>
                <TextInput accessibilityLabel="Дата" onChangeText={setRemindsOn} placeholder="ГГГГ-ММ-ДД" placeholderTextColor="#98A2B3" style={styles.input} value={remindsOn} />
                <Text style={styles.label}>Начало периода</Text>
                <TextInput accessibilityLabel="Начало периода" onChangeText={setPeriodStartOn} placeholder="ГГГГ-ММ-ДД" placeholderTextColor="#98A2B3" style={styles.input} value={periodStartOn} />
                <Text style={styles.label}>Конец периода</Text>
                <TextInput accessibilityLabel="Конец периода" onChangeText={setPeriodEndOn} placeholder="ГГГГ-ММ-ДД" placeholderTextColor="#98A2B3" style={styles.input} value={periodEndOn} />
                <Text style={styles.label}>Повторение</Text>
                <View style={styles.repeatOptions}>
                  {([
                    ['Нет', ''],
                    ['Каждый день', 'daily'],
                    ['Каждую неделю', 'weekly'],
                    ['Каждый месяц', 'monthly'],
                  ] as const).map(([label, value]) => (
                    <Pressable
                      key={label}
                      onPress={() => setRepeatFrequency(value)}
                      style={[styles.repeatOption, repeatFrequency === value && styles.repeatOptionSelected]}>
                      <Text style={[styles.repeatOptionText, repeatFrequency === value && styles.repeatOptionTextSelected]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                {repeatFrequency !== '' ? (
                  <TextInput accessibilityLabel="Интервал повторения" keyboardType="number-pad" onChangeText={setRepeatInterval} placeholder="Интервал" placeholderTextColor="#98A2B3" style={styles.input} value={repeatInterval} />
                ) : null}
              </View>
            ) : null}
            {error === null ? null : <Text style={styles.error}>{error}</Text>}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={[styles.action, styles.secondaryAction]}>
              <Text style={styles.secondaryActionText}>Отмена</Text>
            </Pressable>
            <Pressable accessibilityState={{ disabled: isSaving }} onPress={() => void submit()} style={[styles.action, styles.primaryAction, isSaving && styles.disabledAction]}>
              <Text style={styles.primaryActionText}>{isSaving ? 'Сохранение…' : 'Сохранить'}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16, 24, 40, 0.3)' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: '#F9FAFB' },
  handle: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginTop: 10, backgroundColor: '#D0D5DD' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  heading: { color: '#172033', fontSize: 22, fontWeight: '700' },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#667085', fontSize: 21 },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  label: { marginTop: 14, marginBottom: 7, color: '#344054', fontSize: 14, fontWeight: '600' },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 13, color: '#172033', fontSize: 16 },
  multilineInput: { minHeight: 82, paddingTop: 12, textAlignVertical: 'top' },
  selector: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 13 },
  selectorText: { color: '#172033', fontSize: 16 },
  selectorChevron: { color: '#667085', fontSize: 18 },
  projectOptions: { overflow: 'hidden', marginTop: 5, borderRadius: 12, backgroundColor: '#FFFFFF' },
  option: { paddingHorizontal: 14, paddingVertical: 12 },
  optionText: { color: '#344054', fontSize: 16 },
  reminderFields: { marginTop: 2 },
  repeatOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  repeatOption: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFFFFF' },
  repeatOptionSelected: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  repeatOptionText: { color: '#475467', fontSize: 13 },
  repeatOptionTextSelected: { color: '#4338CA', fontWeight: '700' },
  error: { marginTop: 16, color: '#B42318', fontSize: 14, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#EAECF0', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF' },
  action: { minHeight: 46, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  primaryAction: { backgroundColor: '#4F46E5' },
  secondaryAction: { backgroundColor: '#F2F4F7' },
  primaryActionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryActionText: { color: '#344054', fontSize: 16, fontWeight: '700' },
  disabledAction: { opacity: 0.55 },
});
