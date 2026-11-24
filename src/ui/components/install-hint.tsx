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
      <Text style={font.heading}>Thêm vào màn hình chính</Text>
      <Text style={font.body}>
        {'1. Bấm nút Chia sẻ ở cuối Safari.\n2. Chọn "Thêm vào MH chính", rồi "Thêm".\n3. Mở bảng xếp hạng từ biểu tượng mới.'}
      </Text>
    </View>
  );
}
