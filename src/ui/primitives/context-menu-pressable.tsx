import type { ComponentProps, ComponentType } from 'react';
import { Pressable } from 'react-native';

type ContextMenuEvent = { preventDefault(): void };
type ContextMenuPressableProps = ComponentProps<typeof Pressable> & {
  onContextMenu?: (event: ContextMenuEvent) => void;
};

// React Native Web supports this browser event; React Native's shared type does not declare it.
export const ContextMenuPressable = Pressable as unknown as ComponentType<ContextMenuPressableProps>;
