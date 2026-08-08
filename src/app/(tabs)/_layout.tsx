import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { tabDefinitions, type TabRoute } from '../../ui/tab-definitions';
import { designTokens } from '../../ui/design/tokens';

const tabIcons: Record<TabRoute, keyof typeof Ionicons.glyphMap> = {
  index: 'calendar-outline',
  backlog: 'list-outline',
  completed: 'checkmark-done-outline',
  settings: 'settings-outline',
};

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: designTokens.color.primary,
        tabBarInactiveTintColor: designTokens.color.navigation.inactive,
        tabBarLabelStyle: {
          fontSize: designTokens.typography.size.micro,
          fontWeight: designTokens.typography.weight.semibold,
        },
        tabBarStyle: {
          minHeight: designTokens.size.tabBar,
          borderTopColor: designTokens.color.border.subtle,
          backgroundColor: designTokens.color.navigation.background,
        },
      }}>
      {tabDefinitions.map((tab) => (
        <Tabs.Screen
          key={tab.route}
          name={tab.route}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <Ionicons color={color} name={tabIcons[tab.route]} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
