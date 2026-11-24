import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { colour } from '../../src/ui/theme';

/** The tab bar hands down a colour that may be null; the palette never is. */
function icon(name: ComponentProps<typeof Ionicons>['name'], ownSize?: number) {
  return ({ focused, size }: { focused: boolean; size: number }) => (
    <Ionicons color={focused ? colour.accent : colour.dim} name={name} size={ownSize ?? size} />
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
        tabBarStyle: { backgroundColor: colour.deep, 
                        borderTopColor: colour.line,
                      paddingBottom: 5,
                    height: 70},
        tabBarActiveTintColor: colour.accent,
        tabBarInactiveTintColor: colour.dim,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Bảng Xếp Hạng', headerTitleAlign: 'center', tabBarLabel: 'Xếp hạng', tabBarIcon: icon('trophy') }} />
      <Tabs.Screen name="feed" options={{ title: '', tabBarLabel: 'Feed', tabBarIcon: icon('list') }} />
      <Tabs.Screen
        name="log"
        options={{ title: 'Ghi nhận trận đấu', headerTitleAlign: 'center', tabBarLabel: 'Thêm', tabBarIcon: icon('add-circle', 30)}}
      />
      <Tabs.Screen
        name="me"
        options={{ title: '', tabBarLabel: 'Tôi', tabBarIcon: icon('person') }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Cài đặt', headerTitleAlign: 'center', tabBarIcon: icon('settings') }} />
    </Tabs>
  );
}
