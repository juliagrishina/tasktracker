import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

const energyValues = Array.from({ length: 21 }, (_, index) => index * 5);
const defaultEnergyPercent = 75;
const pickerRowHeight = designTokens.size.touchTargetMin;

interface DailyEnergyCheckInProps {
  initialEnergyPercent?: number | null;
  onRequestClose: () => void;
  onSave: (energyPercent: number) => Promise<void>;
  onSkip?: () => Promise<void>;
  visible: boolean;
}

export function DailyEnergyCheckIn({
  initialEnergyPercent,
  onRequestClose,
  onSave,
  onSkip,
  visible,
}: DailyEnergyCheckInProps) {
  const [selectedEnergyPercent, setSelectedEnergyPercent] = useState(
    initialEnergyPercent ?? defaultEnergyPercent,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedEnergyPercent(initialEnergyPercent ?? defaultEnergyPercent);
      setError(null);
    }
  }, [initialEnergyPercent, visible]);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(selectedEnergyPercent);
      onRequestClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось сохранить оценку энергии');
    } finally {
      setIsSaving(false);
    }
  };

  const skip = async () => {
    if (onSkip === undefined) {
      onRequestClose();
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSkip();
      onRequestClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось пропустить отметку энергии');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal animationType="fade" onRequestClose={() => void skip()} transparent visible={visible}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text style={styles.title}>Энергия на сегодня</Text>
          <Text style={styles.description}>Выберите уровень энергии. Это не изменит ваш план.</Text>
          <View accessibilityLabel="Вертикальный выбор энергии" style={styles.pickerFrame}>
            <ScrollView
              contentOffset={{ x: 0, y: Math.max(0, energyValues.indexOf(selectedEnergyPercent) * pickerRowHeight - pickerRowHeight) }}
              decelerationRate="fast"
              onMomentumScrollEnd={(event) => {
                const index = Math.max(0, Math.min(energyValues.length - 1, Math.round(event.nativeEvent.contentOffset.y / pickerRowHeight)));
                setSelectedEnergyPercent(energyValues[index]);
              }}
              showsVerticalScrollIndicator={false}
              snapToInterval={pickerRowHeight}>
              {energyValues.map((value) => {
                const selected = value === selectedEnergyPercent;
                return (
                  <Pressable
                    accessibilityLabel={`Энергия ${value}%`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    key={value}
                    onPress={() => setSelectedEnergyPercent(value)}
                    style={[styles.pickerRow, selected && styles.pickerRowSelected]}>
                    <Text style={[styles.pickerValue, selected && styles.pickerValueSelected]}>{value}%</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          {error === null ? null : <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          <Pressable accessibilityLabel="Сохранить оценку энергии" accessibilityRole="button" disabled={isSaving} onPress={() => void save()} style={({ pressed }) => [styles.saveAction, pressed && !isSaving && styles.pressed, isSaving && styles.disabled]}>
            <Text style={styles.saveActionText}>Сохранить {selectedEnergyPercent}%</Text>
          </Pressable>
          {onSkip === undefined ? null : <Pressable accessibilityLabel="Пропустить оценку энергии" accessibilityRole="button" disabled={isSaving} onPress={() => void skip()} style={({ pressed }) => [styles.skipAction, pressed && !isSaving && styles.pressed, isSaving && styles.disabled]}>
            <Text style={styles.skipActionText}>Пропустить</Text>
          </Pressable>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: designTokens.color.overlay.scrim, flex: 1, justifyContent: 'center', padding: designTokens.space[20] },
  dialog: { backgroundColor: designTokens.color.surface.raised, borderRadius: designTokens.radius.sheet, gap: designTokens.space[12], maxWidth: 420, padding: designTokens.space[20], width: '100%', ...designTokens.elevation.card },
  title: { color: designTokens.color.text.primary, fontSize: designTokens.typography.size.sectionTitle, fontWeight: designTokens.typography.weight.bold, lineHeight: designTokens.typography.lineHeight.sectionTitle },
  description: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.body, lineHeight: designTokens.typography.lineHeight.body },
  pickerFrame: { borderColor: designTokens.color.border.subtle, borderRadius: designTokens.radius.control, borderWidth: 1, height: pickerRowHeight * 3, overflow: 'hidden' },
  pickerRow: { alignItems: 'center', height: pickerRowHeight, justifyContent: 'center' },
  pickerRowSelected: { backgroundColor: designTokens.color.primarySoft },
  pickerValue: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.body, fontWeight: designTokens.typography.weight.semibold, lineHeight: designTokens.typography.lineHeight.body },
  pickerValueSelected: { color: designTokens.color.primaryStrong, fontWeight: designTokens.typography.weight.bold },
  saveAction: { alignItems: 'center', backgroundColor: designTokens.color.primary, borderRadius: designTokens.radius.control, justifyContent: 'center', minHeight: designTokens.size.touchTargetMin },
  saveActionText: { color: designTokens.color.text.inverse, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.bold, lineHeight: designTokens.typography.lineHeight.label },
  skipAction: { alignItems: 'center', justifyContent: 'center', minHeight: designTokens.size.touchTargetMin },
  skipActionText: { color: designTokens.color.text.secondary, fontSize: designTokens.typography.size.label, fontWeight: designTokens.typography.weight.semibold, lineHeight: designTokens.typography.lineHeight.label },
  error: { color: designTokens.color.feedback.danger.foreground, fontSize: designTokens.typography.size.meta, lineHeight: designTokens.typography.lineHeight.meta },
  pressed: { opacity: designTokens.state.pressedOpacity },
  disabled: { opacity: designTokens.state.disabledOpacity },
});
