import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colour, font, radius, space } from '../theme';

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled = false,
  busy = false,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly tone?: 'primary' | 'quiet' | 'danger';
  readonly disabled?: boolean;
  readonly busy?: boolean;
}) {
  const inert = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={inert}
      onPress={onPress}
      style={({ pressed }) => [
        style.button,
        style[tone],
        pressed ? style.pressed : null,
        inert ? style.inert : null,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={tone === 'primary' ? colour.onAccent : colour.text} />
      ) : (
        <Text style={[font.body, style.label, tone === 'primary' ? style.onAccent : null]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Buttons that sit side by side and share the width evenly. */
export function ButtonRow({ children }: { readonly children: ReactNode }) {
  return <View style={style.group}>{children}</View>;
}

const style = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: space.block,
    borderRadius: radius.field,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    flexBasis: 0,
  },
  group: { flexDirection: 'row', gap: space.row },
  primary: { backgroundColor: colour.accent },
  quiet: { backgroundColor: colour.raised, borderWidth: 1, borderColor: colour.line },
  danger: { backgroundColor: colour.raised, borderWidth: 1, borderColor: colour.down },
  pressed: { opacity: 0.7 },
  inert: { opacity: 0.4 },
  label: { fontWeight: '600' },
  onAccent: { color: colour.onAccent },
});
