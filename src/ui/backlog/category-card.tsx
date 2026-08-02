import { Pressable, StyleSheet, Text, View } from 'react-native';

interface CategoryCardProps {
  title: string;
  count: number;
  previews: readonly string[];
  onPress?: () => void;
}

export function CategoryCard({
  title,
  count,
  previews,
  onPress,
}: CategoryCardProps) {
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.headingRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.count}>{count}</Text>
        </View>
      </View>
      {previews.length === 0 ? (
        <Text style={styles.empty}>Пока здесь пусто</Text>
      ) : (
        <View style={styles.previewList}>
          {previews.slice(0, 2).map((preview) => (
            <Text key={preview} numberOfLines={1} style={styles.preview}>
              {preview}
            </Text>
          ))}
        </View>
      )}
      <Text style={styles.open}>Открыть</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 142,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 18,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  cardPressed: { opacity: 0.78 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#172033', fontSize: 19, fontWeight: '700' },
  countBadge: {
    minWidth: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignItems: 'center',
  },
  count: { color: '#4338CA', fontSize: 14, fontWeight: '700' },
  previewList: { gap: 5, marginTop: 14 },
  preview: { color: '#475467', fontSize: 15, lineHeight: 20 },
  empty: { marginTop: 14, color: '#98A2B3', fontSize: 15 },
  open: { marginTop: 'auto', color: '#4F46E5', fontSize: 14, fontWeight: '700' },
});
