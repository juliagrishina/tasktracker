import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { designTokens } from '../design/tokens';

interface ProgressRingProps {
  label: string;
  value: number;
}

const ringSize = designTokens.size.progressRing;
const ringStroke = designTokens.size.progressRingStroke;
const ringRadius = (ringSize - ringStroke) / 2;
const ringCircumference = 2 * Math.PI * ringRadius;

export function ProgressRing({ label, value }: ProgressRingProps) {
  const normalizedValue = Math.min(Math.max(value, 0), 100);
  const dashOffset = ringCircumference * (1 - normalizedValue / 100);

  return (
    <View
      accessibilityLabel={`Выполнено ${label}`}
      accessibilityRole="progressbar"
      accessibilityValue={{ max: 100, min: 0, now: normalizedValue }}
      style={styles.container}>
      <Svg height={ringSize} width={ringSize}>
        <Circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          fill="none"
          r={ringRadius}
          stroke={designTokens.color.calendar.progressTrack}
          strokeWidth={ringStroke}
        />
        <Circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          fill="none"
          r={ringRadius}
          rotation="-90"
          stroke={designTokens.color.primary}
          strokeDasharray={`${ringCircumference} ${ringCircumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth={ringStroke}
          transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
        />
      </Svg>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    height: ringSize,
    justifyContent: 'center',
    width: ringSize,
  },
  label: {
    color: designTokens.color.text.primary,
    fontSize: designTokens.typography.size.meta,
    fontWeight: designTokens.typography.weight.bold,
    lineHeight: designTokens.typography.lineHeight.meta,
    position: 'absolute',
  },
});
