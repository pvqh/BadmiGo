import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { colour } from '../../src/ui/theme';

/** The tab bar hands down a colour that may be null; the palette never is. */
function icon(name: ComponentProps<typeof Ionicons>['name']) {
  return ({ focused, size }: { focused: boolean; size: number }) => (
    <Ionicons color={focused ? colour.accent : colour.dim} name={name} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colour.background },
        headerTintColor: colour.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colour.background },
        tabBarStyle: { backgroundColor: colour.deep, borderTopColor: colour.line },
        tabBarActiveTintColor: colour.accent,
        tabBarInactiveTintColor: colour.dim,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Bảng Xếp Hạng', tabBarIcon: icon('trophy') }} />
      <Tabs.Screen name="feed" options={{ title: '', tabBarLabel: 'Feed', tabBarIcon: icon('list') }} />
      <Tabs.Screen
        name="log"
        options={{ title: '', tabBarLabel: 'Log', tabBarIcon: icon('add-circle') }}
      />
      <Tabs.Screen
        name="me"
        options={{ title: '', tabBarLabel: 'Me', tabBarIcon: icon('person') }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Cài đặt', tabBarIcon: icon('settings') }} />
    </Tabs>
  );
}
