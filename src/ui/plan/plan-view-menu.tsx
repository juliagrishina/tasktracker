import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { designTokens } from '../design/tokens';

import type { PlanViewMode } from './plan-period-model';

const modeLabels: Record<PlanViewMode, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
};

const modes: PlanViewMode[] = ['day', 'week', 'month'];

interface PlanViewMenuProps {
  mode: PlanViewMode;
  onRequestClose: () => void;
  onSelectMode: (mode: PlanViewMode) => void;
  visible: boolean;
}

export function getPlanViewModeLabel(mode: PlanViewMode): string {
  return modeLabels[mode];
}

export function PlanViewMenu({ mode, onRequestClose, onSelectMode, visible }: PlanViewMenuProps) {
  const selectMode = (nextMode: PlanViewMode) => {
    onSelectMode(nextMode);
    onRequestClose();
  };

  return (
    <Modal animationType="fade" onRequestClose={onRequestClose} transparent visible={visible}>
      <Pressable accessibilityLabel="Закрыть выбор режима" onPress={onRequestClose} style={styles.scrim}>
        <Pressable accessibilityRole="menu" onPress={(event) => event.stopPropagation()} style={styles.menu}>
          {modes.map((option) => {
            const selected = option === mode;
            return (
              <Pressable
                accessibilityLabel={modeLabels[option]}
                accessibilityRole="button"
                key={option}
                onPress={() => selectMode(option)}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
                <Text style={[styles.optionText, selected && styles.selectedText]}>{modeLabels[option]}</Text>
                {selected ? <Ionicons color={designTokens.color.primaryStrong} name="checkmark" size={20} /> : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    alignItems: 'flex-end',
    backgroundColor: designTokens.color.overlay.scrim,
    flex: 1,
    justifyContent: 'flex-start',
    paddingRight: designTokens.space[16],
    paddingTop: designTokens.space[24] + designTokens.space[24],
  },
  menu: {
    backgroundColor: designTokens.color.surface.raised,
    borderColor: designTokens.color.border.subtle,
    borderRadius: designTokens.radius.row,
    borderWidth: 1,
    minWidth: 156,
    overflow: 'hidden',
    ...designTokens.elevation.card,
  },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: designTokens.size.touchTargetMin,
    paddingHorizontal: designTokens.space[12],
  },
  optionText: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.label,
    fontWeight: designTokens.typography.weight.semibold,
    lineHeight: designTokens.typography.lineHeight.label,
  },
  selectedText: {
    color: designTokens.color.primaryStrong,
  },
  pressed: {
    opacity: designTokens.state.pressedOpacity,
  },
});
