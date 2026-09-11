import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { designTokens } from '../design/tokens';

interface PasswordInputProps extends Omit<TextInputProps, 'accessibilityLabel' | 'secureTextEntry'> {
  accessibilityLabel: string;
  visibilityLabel: string;
}

export function PasswordInput({
  accessibilityLabel,
  visibilityLabel,
  style,
  ...inputProps
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const action = isVisible ? 'Скрыть' : 'Показать';

  return (
    <View style={styles.container}>
      <TextInput
        {...inputProps}
        accessibilityLabel={accessibilityLabel}
        key={isVisible ? 'visible' : 'hidden'}
        secureTextEntry={!isVisible}
        style={[style, styles.input]}
      />
      <Pressable
        accessibilityHint={`${action} введённые символы.`}
        accessibilityLabel={`${action} ${visibilityLabel}`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => setIsVisible((visible) => !visible)}
        style={styles.toggle}>
        <Ionicons
          color={designTokens.color.text.secondary}
          name={isVisible ? 'eye-off-outline' : 'eye-outline'}
          size={22}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  input: {
    paddingRight: 52,
  },
  toggle: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: designTokens.size.touchTargetMin,
    minWidth: designTokens.size.touchTargetMin,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
