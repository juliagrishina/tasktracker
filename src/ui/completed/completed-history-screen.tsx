import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { designTokens } from '../design/tokens';
import { SurfaceCard } from '../primitives/surface-card';
import { temporaryWebContentStyle } from '../screen-shell';

import { completedDemoGroups, type CompletedDemoItem, type CompletedDemoKind } from './completed-demo-data';

const periods = ['Сегодня', 'Неделя', 'Месяц', 'Год'] as const;
type CompletedPeriod = (typeof periods)[number];

const typeIcons: Record<CompletedDemoKind, keyof typeof Ionicons.glyphMap> = {
  project: 'folder-outline',
  reminder: 'time-outline',
  task: 'checkmark',
};

export function CompletedHistoryScreen() {
  const [period, setPeriod] = useState<CompletedPeriod>('Неделя');
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const filteredGroups = useMemo(() => filterGroups(query), [query]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerSurface}>
        <View style={[styles.header, temporaryWebContentStyle()]}>
          <Text style={styles.title}>Завершённые</Text>
          <Text style={styles.subtitle}>Архив проектов, задач и напоминаний</Text>
          <View style={styles.searchField}>
            <Ionicons color={designTokens.color.text.tertiary} name="search-outline" size={18} />
            <TextInput
              accessibilityLabel="Поиск по названию"
              onChangeText={setQuery}
              placeholder="Поиск по названию"
              placeholderTextColor={designTokens.color.text.tertiary}
              style={styles.searchInput}
              value={query}
            />
          </View>
          <View style={styles.periods}>
            {periods.map((item) => (
              <Pressable
                accessibilityLabel={item}
                accessibilityRole="button"
                accessibilityState={{ selected: period === item }}
                key={item}
                onPress={() => setPeriod(item)}
                style={({ pressed }) => [styles.periodButton, period === item && styles.periodButtonSelected, pressed && styles.pressed]}>
                <Text style={[styles.periodLabel, period === item && styles.periodLabelSelected]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, temporaryWebContentStyle()]}>
        {filteredGroups.length === 0 ? (
          <Text style={styles.empty}>Ничего не найдено</Text>
        ) : filteredGroups.map((group) => (
          <View key={group.id} style={styles.group}>
            <View style={styles.groupHeading}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <Text style={styles.groupCount}>{formatElementCount(group.items.length)}</Text>
            </View>
            <SurfaceCard style={styles.groupList}>
              {group.items.map((item, index) => (
                <CompletedRow
                  item={item}
                  key={item.id}
                  onPressMore={() => setFeedback(`Действия для «${item.title}» доступны в демо-режиме`)}
                  showDivider={index !== group.items.length - 1}
                />
              ))}
            </SurfaceCard>
          </View>
        ))}

        <View style={styles.warning}>
          <Text style={styles.warningText}>Удалить окончательно доступно только с подтверждением.</Text>
        </View>
        {feedback === null ? null : <Text accessibilityLiveRegion="polite" style={styles.feedback}>{feedback}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function CompletedRow({ item, onPressMore, showDivider }: {
  item: CompletedDemoItem;
  onPressMore: () => void;
  showDivider: boolean;
}) {
  return (
    <View style={[styles.row, showDivider && styles.rowDivider]}>
      <View style={[styles.typeIcon, item.kind === 'reminder' && styles.reminderIcon, item.kind === 'project' && styles.projectIcon]}>
        <Ionicons color={iconColor(item.kind)} name={typeIcons[item.kind]} size={17} />
      </View>
      <View style={styles.itemCopy}>
        <Text numberOfLines={1} style={styles.itemTitle}>{item.title}</Text>
        <Text numberOfLines={1} style={styles.itemDetail}>{item.detail}</Text>
      </View>
      <View style={styles.trailing}>
        <Text style={styles.time}>{item.time}</Text>
        <Pressable accessibilityLabel={`Действия: ${item.title}`} accessibilityRole="button" onPress={onPressMore} style={styles.moreButton}>
          <Ionicons color={designTokens.color.text.tertiary} name="ellipsis-horizontal" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

function filterGroups(query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');

  return completedDemoGroups
    .map((group) => ({
      ...group,
      items: normalizedQuery.length === 0
        ? group.items
        : group.items.filter((item) => item.title.toLocaleLowerCase('ru-RU').includes(normalizedQuery)),
    }))
    .filter((group) => group.items.length > 0);
}

function formatElementCount(count: number) {
  return `${count} ${count === 1 ? 'элемент' : count >= 2 && count <= 4 ? 'элемента' : 'элементов'}`;
}

function iconColor(kind: CompletedDemoKind) {
  if (kind === 'project') {
    return designTokens.color.primaryStrong;
  }

  if (kind === 'reminder') {
    return designTokens.color.feedback.warning.foreground;
  }

  return designTokens.color.feedback.success.foreground;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: designTokens.color.surface.canvas,
  },
  headerSurface: {
    backgroundColor: designTokens.color.surface.raised,
    borderBottomColor: designTokens.color.border.subtle,
    borderBottomWidth: 1,
  },
  header: {
    paddingHorizontal: designTokens.space[16],
    paddingVertical: designTokens.space[12],
  },
  title: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.screenTitle,
    fontWeight: designTokens.typography.weight.bold,
    letterSpacing: designTokens.typography.tracking.title,
    lineHeight: designTokens.typography.lineHeight.screenTitle,
  },
  subtitle: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
    marginTop: designTokens.space[2],
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: designTokens.color.surface.subtle,
    borderRadius: designTokens.radius.row,
    flexDirection: 'row',
    gap: designTokens.space[6],
    marginTop: designTokens.space[10],
    minHeight: designTokens.size.touchTargetMin,
    paddingHorizontal: designTokens.space[10],
  },
  searchInput: {
    color: designTokens.color.text.primary,
    flex: 1,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
    minHeight: designTokens.size.touchTargetMin,
  },
  periods: {
    flexDirection: 'row',
    gap: designTokens.space[4],
    marginTop: designTokens.space[8],
  },
  periodButton: {
    alignItems: 'center',
    backgroundColor: designTokens.color.surface.subtle,
    borderRadius: designTokens.radius.control,
    flex: 1,
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
    paddingHorizontal: designTokens.space[4],
  },
  periodButtonSelected: {
    backgroundColor: designTokens.color.primarySoft,
  },
  periodLabel: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.micro,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.micro,
  },
  periodLabelSelected: {
    color: designTokens.color.primaryStrong,
  },
  content: {
    paddingBottom: designTokens.space[24],
    paddingHorizontal: designTokens.space[12],
    paddingTop: designTokens.space[10],
  },
  group: {
    marginTop: designTokens.space[10],
  },
  groupHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: designTokens.space[2],
    paddingVertical: designTokens.space[6],
  },
  groupTitle: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  groupCount: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.micro,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.micro,
  },
  groupList: {
    overflow: 'hidden',
    padding: 0,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: designTokens.space[8],
    minHeight: designTokens.size.touchTargetMin + designTokens.space[8],
    paddingHorizontal: designTokens.space[10],
    paddingVertical: designTokens.space[8],
  },
  rowDivider: {
    borderBottomColor: designTokens.color.border.subtle,
    borderBottomWidth: 1,
  },
  typeIcon: {
    alignItems: 'center',
    backgroundColor: designTokens.color.feedback.success.surface,
    borderRadius: designTokens.radius.control,
    height: designTokens.space[24] + designTokens.space[4],
    justifyContent: 'center',
    width: designTokens.space[24] + designTokens.space[4],
  },
  reminderIcon: {
    backgroundColor: designTokens.color.feedback.warning.surface,
  },
  projectIcon: {
    backgroundColor: designTokens.color.primarySoft,
  },
  itemCopy: {
    flex: 1,
  },
  itemTitle: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  itemDetail: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.micro,
    lineHeight: designTokens.typography.lineHeight.micro,
    marginTop: designTokens.space[2],
  },
  trailing: {
    alignItems: 'flex-end',
  },
  time: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.micro,
    lineHeight: designTokens.typography.lineHeight.micro,
  },
  moreButton: {
    alignItems: 'center',
    height: designTokens.size.touchTargetMin,
    justifyContent: 'center',
    marginBottom: -designTokens.space[8],
    marginRight: -designTokens.space[10],
    marginTop: -designTokens.space[8],
    width: designTokens.size.touchTargetMin,
  },
  warning: {
    backgroundColor: designTokens.color.feedback.warning.surface,
    borderColor: designTokens.color.feedback.warning.border,
    borderRadius: designTokens.radius.row,
    borderWidth: 1,
    marginTop: designTokens.space[12],
    padding: designTokens.space[10],
  },
  warningText: {
    color: designTokens.color.feedback.warning.foreground,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  feedback: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
    marginTop: designTokens.space[12],
    textAlign: 'center',
  },
  empty: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
    marginTop: designTokens.space[24],
    textAlign: 'center',
  },
  pressed: {
    opacity: designTokens.state.pressedOpacity,
  },
});
