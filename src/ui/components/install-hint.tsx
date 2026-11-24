import { Text, View } from 'react-native';
import { needsHomeScreenInstall } from '../../data/notifications';
import { font, layout } from '../theme';

/**
 * Story 76. Safari has no install button, so the steps are spelled out, and they say
 * why: notifications only reach the app once it is on the home screen.
 */
export function InstallHint() {
  if (!needsHomeScreenInstall()) return null;

  return (
    <View style={layout.card}>
      <Text style={font.heading}>Add it to your home screen</Text>
      <Text style={font.body}>
        1. Tap the Share button at the bottom of Safari.{'\n'}
        2. Choose "Add to Home Screen", then "Add".{'\n'}
        3. Open the ladder from the new icon.
      </Text>
      <Text style={font.dim}>
        It then opens full-screen like an app, and it is the only way an iPhone will
        let it send you notifications.
      </Text>
    </View>
  );
}
