import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { tabDefinitions, type TabRoute } from '../../ui/tab-definitions';

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
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#667085',
        tabBarStyle: { borderTopColor: '#EAECF0' },
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
