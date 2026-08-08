import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';
import { SurfaceCard } from '../primitives/surface-card';

export type BacklogCategoryKind = 'reminders' | 'unassigned' | 'projects';

interface CategoryCardProps {
  title: string;
  count: number;
  previews: readonly CategoryPreview[];
  kind: BacklogCategoryKind;
  onPress?: () => void;
  subtitle: string;
}

interface CategoryPreview {
  detail: string;
  title: string;
}

const categoryVisuals: Record<BacklogCategoryKind, {
  icon: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  color: string;
  actionLabel: string;
}> = {
  reminders: {
    icon: 'time-outline',
    backgroundColor: designTokens.color.feedback.warning.surface,
    color: designTokens.color.feedback.warning.foreground,
    actionLabel: 'Открыть раздел',
  },
  unassigned: {
    icon: 'square-outline',
    backgroundColor: designTokens.color.primarySoft,
    color: designTokens.color.primaryStrong,
    actionLabel: 'Открыть раздел',
  },
  projects: {
    icon: 'folder-outline',
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
  subtitle,
}: CategoryCardProps) {
  const visual = categoryVisuals[kind];

  return (
    <SurfaceCard accessibilityLabel={title} onPress={onPress} style={styles.card}>
      <View style={styles.headingRow}>
        <View style={[styles.icon, { backgroundColor: visual.backgroundColor }]}>
          <Ionicons color={visual.color} name={visual.icon} size={20} />
        </View>
        <View style={styles.titleColumn}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Ionicons color={designTokens.color.text.tertiary} name="chevron-forward" size={20} />
      </View>
      {previews.length === 0 ? (
        <Text style={styles.empty}>Пока здесь пусто</Text>
      ) : (
        <View style={styles.previewList}>
          {previews.slice(0, 2).map((preview) => (
            <View key={preview.title} style={styles.previewRow}>
              <View style={styles.previewMarker} />
              <Text numberOfLines={1} style={styles.preview}>{preview.title}</Text>
              <Text numberOfLines={1} style={styles.previewDetail}>{preview.detail}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.openRow}>
        <Text style={styles.open}>{visual.actionLabel}</Text>
        <Text style={styles.countAction}>{count} →</Text>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
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
  previewDetail: {
    color: designTokens.color.text.secondary,
    fontSize: designTokens.typography.size.micro,
    lineHeight: designTokens.typography.lineHeight.micro,
    maxWidth: designTokens.space[32] + designTokens.space[12],
    textAlign: 'right',
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
  countAction: {
    color: designTokens.color.primary,
    fontSize: designTokens.typography.size.meta,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.meta,
  },
});
