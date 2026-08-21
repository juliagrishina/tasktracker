import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

export interface PlanningValueOption { label: string; value: string; }
export function PlanningValuePicker({ accessibilityLabel, onChange, options, value, title }: { accessibilityLabel: string; onChange: (value: string) => void; options: readonly PlanningValueOption[]; value: string; title: string }) {
  const [visible, setVisible] = useState(false);
  const selected = options.find((option) => option.value === value);
  return <View>
    <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={() => setVisible(true)} style={styles.trigger}><Text style={styles.triggerText}>{selected?.label ?? 'Выбрать'}</Text><Text>⌄</Text></Pressable>
    <Modal animationType="slide" onRequestClose={() => setVisible(false)} transparent visible={visible}>
      <View style={styles.overlay}><Pressable accessibilityLabel={`Закрыть выбор: ${title}`} onPress={() => setVisible(false)} style={styles.scrim} /><View style={styles.sheet}><Text style={styles.title}>{title}</Text><FlatList data={options} getItemLayout={(_, index) => ({ index, length: 44, offset: index * 44 })} initialNumToRender={16} keyExtractor={(option) => option.value} renderItem={({ item }) => <Pressable accessibilityLabel={item.label} accessibilityRole="button" onPress={() => { onChange(item.value); setVisible(false); }} style={[styles.option, item.value === value && styles.selected]}><Text style={styles.optionText}>{item.label}</Text></Pressable>} /></View></View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  trigger: { alignItems: 'center', backgroundColor: designTokens.color.surface.raised, borderColor: designTokens.color.border.subtle, borderRadius: designTokens.radius.control, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: designTokens.size.touchTargetMin, paddingHorizontal: designTokens.space[12] },
  triggerText: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.body }, overlay: { flex: 1, justifyContent: 'flex-end' }, scrim: { backgroundColor: designTokens.color.overlay.scrim, bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }, sheet: { backgroundColor: designTokens.color.surface.raised, borderTopLeftRadius: designTokens.radius.sheet, borderTopRightRadius: designTokens.radius.sheet, maxHeight: '70%', padding: designTokens.space[16] }, title: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.sectionTitle, fontWeight: designTokens.typography.weight.bold, marginBottom: designTokens.space[8] }, option: { justifyContent: 'center', minHeight: designTokens.size.touchTargetMin, paddingHorizontal: designTokens.space[12] }, selected: { backgroundColor: designTokens.color.primarySoft, borderRadius: designTokens.radius.control }, optionText: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.body },
});
