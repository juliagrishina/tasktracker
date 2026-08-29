import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { designTokens } from '../design/tokens';

const fallbackTimeZoneIds = [
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Almaty',
  'Asia/Tokyo',
  'Australia/Sydney',
  'America/New_York',
  'America/Los_Angeles',
] as const;

function getTimeZoneIds(selectedTimeZoneId: string): readonly string[] {
  const supportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => readonly string[] }).supportedValuesOf;
  const values = supportedValuesOf?.('timeZone') ?? fallbackTimeZoneIds;
  return [...new Set([...values, selectedTimeZoneId])].sort((left, right) => left.localeCompare(right));
}

export function TimeZonePicker({ onSelect, onRequestClose, selectedTimeZoneId, visible }: {
  onRequestClose: () => void;
  onSelect: (timeZoneId: string) => void;
  selectedTimeZoneId: string;
  visible: boolean;
}) {
  const [query, setQuery] = useState('');
  const timeZoneIds = useMemo(() => getTimeZoneIds(selectedTimeZoneId), [selectedTimeZoneId]);
  const filteredTimeZoneIds = useMemo(
    () => timeZoneIds.filter((timeZoneId) => timeZoneId.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),
    [query, timeZoneIds],
  );

  return (
    <Modal animationType="slide" onRequestClose={onRequestClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="Закрыть выбор часового пояса" onPress={onRequestClose} style={styles.scrim} />
        <View accessibilityViewIsModal style={styles.sheet}>
          <Text style={styles.title}>Часовой пояс</Text>
          <Text style={styles.description}>Выберите IANA-идентификатор из списка.</Text>
          <TextInput
            accessibilityLabel="Поиск часового пояса"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Например, Europe/Berlin"
            placeholderTextColor={designTokens.color.text.tertiary}
            style={styles.searchInput}
            value={query}
          />
          <FlatList
            data={filteredTimeZoneIds}
            initialNumToRender={24}
            keyExtractor={(item) => item}
            ListEmptyComponent={<Text style={styles.empty}>Нет подходящего часового пояса</Text>}
            renderItem={({ item }) => (
              <Pressable
                accessibilityLabel={item}
                accessibilityRole="button"
                onPress={() => { onSelect(item); onRequestClose(); }}
                style={[styles.option, item === selectedTimeZoneId && styles.selected]}>
                <Text style={styles.optionText}>{item}</Text>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: designTokens.color.overlay.scrim, bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  sheet: { backgroundColor: designTokens.color.surface.raised, borderTopLeftRadius: designTokens.radius.sheet, borderTopRightRadius: designTokens.radius.sheet, maxHeight: '78%', padding: designTokens.space[16] },
  title: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.sectionTitle, fontWeight: designTokens.typography.weight.bold, lineHeight: designTokens.typography.lineHeight.sectionTitle },
  description: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.meta, lineHeight: designTokens.typography.lineHeight.meta, marginTop: designTokens.space[4] },
  searchInput: { backgroundColor: designTokens.color.surface.base, borderColor: designTokens.color.border.subtle, borderRadius: designTokens.radius.control, borderWidth: 1, color: designTokens.color.text.primary, marginBottom: designTokens.space[8], marginTop: designTokens.space[12], minHeight: designTokens.size.touchTargetMin, paddingHorizontal: designTokens.space[12] },
  option: { justifyContent: 'center', minHeight: designTokens.size.touchTargetMin, paddingHorizontal: designTokens.space[12] },
  selected: { backgroundColor: designTokens.color.primarySoft, borderRadius: designTokens.radius.control },
  optionText: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.body, lineHeight: designTokens.typography.lineHeight.body },
  empty: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.body, paddingVertical: designTokens.space[16], textAlign: 'center' },
});
