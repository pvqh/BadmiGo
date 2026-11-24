import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, layout } from '../theme';

/**
 * A tab's big heading, drawn in the page rather than in a navigation bar, clear of the
 * status bar. `aside` holds a screen's one or two header buttons.
 */
export function ScreenTitle({ title, aside }: { readonly title: string; readonly aside?: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[layout.spread, { paddingTop: insets.top + 12, minHeight: 44 }]}>
      <Text accessibilityRole="header" style={font.title}>
        {title}
      </Text>
      {aside}
    </View>
  );
}
