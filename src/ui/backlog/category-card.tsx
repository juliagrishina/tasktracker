import { StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';
import { StatusPill } from '../primitives/status-pill';
import { SurfaceCard } from '../primitives/surface-card';

export type BacklogCategoryKind = 'reminders' | 'unassigned' | 'projects';

interface CategoryCardProps {
  title: string;
  count: number;
  previews: readonly string[];
  kind: BacklogCategoryKind;
  onPress?: () => void;
}

const categoryVisuals: Record<BacklogCategoryKind, {
  glyph: string;
  backgroundColor: string;
  color: string;
  actionLabel: string;
}> = {
  reminders: {
    glyph: '◷',
    backgroundColor: designTokens.color.feedback.warning.surface,
    color: designTokens.color.feedback.warning.foreground,
    actionLabel: 'Открыть раздел',
  },
  unassigned: {
    glyph: '□',
    backgroundColor: designTokens.color.primarySoft,
    color: designTokens.color.primaryStrong,
    actionLabel: 'Открыть раздел',
  },
  projects: {
    glyph: '▰',
    backgroundColor: designTokens.color.primarySoft,
    color: designTokens.color.primaryStrong,
    actionLabel: 'Перейти к проектам',
  },
};

export function CategoryCard({
  title,
  count,
  previews,
  kind,
  onPress,
}: CategoryCardProps) {
  const visual = categoryVisuals[kind];

  return (
    <SurfaceCard accessibilityLabel={title} onPress={onPress} style={styles.card}>
      <View style={styles.headingRow}>
        <View style={[styles.icon, { backgroundColor: visual.backgroundColor }]}>
          <Text style={[styles.iconGlyph, { color: visual.color }]}>{visual.glyph}</Text>
        </View>
        <View style={styles.titleColumn}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{count === 0 ? 'Пока нет элементов' : `${count} ${count === 1 ? 'элемент' : 'элемента'}`}</Text>
        </View>
        <StatusPill label={String(count)} tone="neutral" />
      </View>
      {previews.length === 0 ? (
        <Text style={styles.empty}>Пока здесь пусто</Text>
      ) : (
        <View style={styles.previewList}>
          {previews.slice(0, 2).map((preview) => (
            <View key={preview} style={styles.previewRow}>
              <View style={styles.previewMarker} />
              <Text numberOfLines={1} style={styles.preview}>{preview}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.openRow}>
        <Text style={styles.open}>{visual.actionLabel}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 154,
    padding: designTokens.space[12],
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: designTokens.space[8],
  },
  icon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designTokens.radius.control,
  },
  iconGlyph: {
    fontSize: designTokens.typography.size.sectionTitle,
    lineHeight: designTokens.typography.lineHeight.sectionTitle,
    fontWeight: designTokens.typography.weight.bold,
  },
  titleColumn: { flex: 1 },
  title: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
    fontWeight: designTokens.typography.weight.bold,
  },
  subtitle: {
    marginTop: designTokens.space[2],
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.meta,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
  previewList: {
    marginTop: designTokens.space[10],
    overflow: 'hidden',
    borderRadius: designTokens.radius.row,
    backgroundColor: designTokens.color.surface.base,
  },
  previewRow: {
    minHeight: designTokens.size.touchTargetMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: designTokens.space[8],
    borderBottomWidth: 1,
    borderBottomColor: designTokens.color.border.subtle,
    paddingHorizontal: designTokens.space[10],
  },
  previewMarker: {
    width: 12,
    height: 12,
    borderWidth: 1.5,
    borderColor: designTokens.color.text.tertiary,
    borderRadius: designTokens.radius.pill,
  },
  preview: {
    flex: 1,
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
    fontWeight: designTokens.typography.weight.semibold,
  },
  empty: {
    marginTop: designTokens.space[12],
    color: designTokens.color.text.tertiary,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  openRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: designTokens.space[10],
  },
  open: {
    color: designTokens.color.primary,
    fontSize: designTokens.typography.size.label,
    lineHeight: designTokens.typography.lineHeight.label,
    fontWeight: designTokens.typography.weight.bold,
  },
  chevron: {
    color: designTokens.color.primary,
    fontSize: designTokens.typography.size.sectionTitle,
  },
});
