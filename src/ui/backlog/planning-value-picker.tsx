import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

export interface PlanningValueOption {
  label: string;
  value: string;
}

export interface PlanningValuePickerProps {
  accessibilityLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  options: readonly PlanningValueOption[];
  placeholder?: string;
  title: string;
  value: string;
}

export function PlanningValuePicker({
  accessibilityLabel,
  disabled = false,
  onChange,
  options,
  placeholder = 'Выбрать',
  title,
  value,
}: PlanningValuePickerProps) {
  const [visible, setVisible] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  return (
    <View>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: visible }}
        disabled={disabled}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.trigger,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}>
        <Text style={[styles.triggerText, selectedOption === undefined && styles.placeholder]}>
          {selectedOption?.label ?? placeholder}
        </Text>
        <Ionicons color={designTokens.color.text.secondary} name="chevron-down" size={18} />
      </Pressable>

      {visible ? (
        <Modal animationType="fade" onRequestClose={() => setVisible(false)} transparent visible>
          <View style={styles.overlay}>
            <Pressable
              accessibilityLabel={`Закрыть выбор: ${title}`}
              accessibilityRole="button"
              onPress={() => setVisible(false)}
              style={styles.scrim}
            />
            <View accessibilityLabel={title} style={styles.sheet}>
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <Pressable
                  accessibilityLabel={`Закрыть выбор: ${title}`}
                  accessibilityRole="button"
                  onPress={() => setVisible(false)}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <Ionicons color={designTokens.color.text.primary} name="close" size={22} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.options} keyboardShouldPersistTaps="handled">
                {options.map((option) => {
                  const selected = option.value === value;
                  return (
                    <Pressable
                      accessibilityLabel={option.label}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={option.value}
                      onPress={() => {
                        onChange(option.value);
                        setVisible(false);
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        selected && styles.optionSelected,
                        pressed && styles.pressed,
                      ]}>
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                      {selected ? (
                        <Ionicons color={designTokens.color.primaryStrong} name="checkmark" size={20} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: 'center',
    backgroundColor: designTokens.color.surface.raised,
    borderColor: designTokens.color.border.subtle,
    borderRadius: designTokens.radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: designTokens.space[8],
    minHeight: designTokens.size.touchTargetMin,
    paddingHorizontal: designTokens.space[12],
  },
  triggerText: {
    color: designTokens.color.text.primary,
    flex: 1,
    fontSize: designTokens.typography.size.body,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.body,
  },
  placeholder: {
    color: designTokens.color.text.secondary,
    fontWeight: designTokens.typography.weight.regular,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    backgroundColor: designTokens.color.overlay.scrim,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sheet: {
    backgroundColor: designTokens.color.surface.raised,
    borderTopLeftRadius: designTokens.radius.sheet,
    borderTopRightRadius: designTokens.radius.sheet,
    maxHeight: '72%',
    paddingBottom: designTokens.space[24],
    ...designTokens.elevation.card,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: designTokens.color.border.subtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 60,
    paddingHorizontal: designTokens.space[16],
  },
  title: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.sectionTitle,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.sectionTitle,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: designTokens.radius.pill,
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
    minWidth: designTokens.size.touchTargetMin,
  },
  options: {
    paddingHorizontal: designTokens.space[12],
    paddingVertical: designTokens.space[8],
  },
  option: {
    alignItems: 'center',
    borderRadius: designTokens.radius.control,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: designTokens.size.touchTargetMin,
    paddingHorizontal: designTokens.space[12],
  },
  optionSelected: {
    backgroundColor: designTokens.color.primarySoft,
  },
  optionText: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.body,
    lineHeight: designTokens.typography.lineHeight.body,
  },
  optionTextSelected: {
    color: designTokens.color.primaryStrong,
    fontWeight: designTokens.typography.weight.semibold,
  },
  pressed: {
    opacity: designTokens.state.pressedOpacity,
  },
  disabled: {
    opacity: designTokens.state.disabledOpacity,
  },
});
