import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colour, font, radius } from '../../src/ui/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Filled when the tab is open, outlined when it is not, so the shape says it too. */
function icon(open: IconName, closed: IconName) {
  return ({ focused }: { focused: boolean }) => (
    <Ionicons color={focused ? colour.courtInk : colour.dim} name={focused ? open : closed} size={24} />
  );
}

/** Logging a game is the one thing done between games, so it is the button that stands up. */
function logIcon() {
  return <View style={style.log}><Ionicons color={colour.onShuttle} name="add" size={30} /></View>;
}

/** Each tab draws its own title, so the screens can put their big heading in the page. */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colour.background },
        tabBarStyle: {
          backgroundColor: colour.card,
          borderTopColor: colour.line,
          height: 70 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: { ...font.dim, fontSize: 11, fontWeight: '600' },
        tabBarActiveTintColor: colour.courtInk,
        tabBarInactiveTintColor: colour.dim,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Xếp hạng', tabBarIcon: icon('trophy', 'trophy-outline') }} />
      <Tabs.Screen name="feed" options={{ title: 'Bảng tin', tabBarIcon: icon('list', 'list-outline') }} />
      <Tabs.Screen
        name="log"
        options={{ title: 'Ghi trận', tabBarActiveTintColor: colour.text, tabBarIcon: logIcon }}
      />
      <Tabs.Screen name="me" options={{ title: 'Tôi', tabBarIcon: icon('person', 'person-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Cài đặt', tabBarIcon: icon('settings', 'settings-outline') }} />
    </Tabs>
  );
}

const style = StyleSheet.create({
  log: {
    width: 52,
    height: 52,
    marginTop: -22,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: colour.background,
    backgroundColor: colour.shuttle,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
