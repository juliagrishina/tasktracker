import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { designTokens } from '../design/tokens';

interface SurfaceCardProps {
  children: ReactNode;
  accessibilityLabel?: string;
  onPress?: () => void;
  tone?: 'default' | 'info';
  style?: StyleProp<ViewStyle>;
}

export function SurfaceCard({
  children,
  accessibilityLabel,
  onPress,
  tone = 'default',
  style,
}: SurfaceCardProps) {
  const cardStyle = [styles.card, tone === 'info' && styles.infoCard, style];

  if (onPress === undefined) {
    return <View style={cardStyle}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: designTokens.size.touchTargetMin,
    borderWidth: 1,
    borderColor: designTokens.color.border.subtle,
    borderRadius: designTokens.radius.card,
    backgroundColor: designTokens.color.surface.raised,
    padding: designTokens.space[12],
    ...designTokens.elevation.card,
  },
  infoCard: {
    borderColor: designTokens.color.border.info,
    backgroundColor: designTokens.color.surface.info,
  },
  pressed: {
    opacity: designTokens.state.pressedOpacity,
  },
});
