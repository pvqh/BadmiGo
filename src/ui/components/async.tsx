import { ActivityIndicator, Text, View } from 'react-native';
import { colour, font, layout } from '../theme';
import { Button } from './button';

/** The three things a screen can be instead of its content. */

export function Pending() {
  return (
    <View style={layout.centre}>
      <ActivityIndicator color={colour.courtInk} />
    </View>
  );
}

export function Problem({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry?: () => void;
}) {
  return (
    <View style={layout.centre}>
      <Text style={font.heading}>Không tải được</Text>
      <Text style={[font.dim, { textAlign: 'center' }]}>{message}</Text>
      {onRetry !== undefined ? <Button label="Thử lại" tone="quiet" onPress={onRetry} /> : null}
    </View>
  );
}

export function Nothing({ message }: { readonly message: string }) {
  return (
    <View style={layout.centre}>
      <Text style={[font.dim, { textAlign: 'center' }]}>{message}</Text>
    </View>
  );
}
