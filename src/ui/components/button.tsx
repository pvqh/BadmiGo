import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colour, font, radius, space } from '../theme';

/**
 * A disabled button is drawn flat and grey rather than faded, so it reads as "not yet"
 * instead of as a broken colour, and its label can say what is still missing.
 */
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
      accessibilityState={{ disabled: inert, busy }}
      disabled={inert}
      onPress={onPress}
      style={({ pressed }) => [
        style.button,
        style[tone],
        disabled ? style.disabled : null,
        pressed ? style.pressed : null,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={tone === 'primary' ? colour.onShuttle : colour.courtInk} />
      ) : (
        <Text style={[style.label, disabled ? style.disabledLabel : LABEL[tone]]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Buttons that sit side by side and share the width evenly. */
export function ButtonRow({ children }: { readonly children: ReactNode }) {
  return <View style={style.group}>{children}</View>;
}

const LABEL = {
  primary: { color: colour.onShuttle },
  quiet: { color: colour.courtInk },
  danger: { color: colour.down },
} as const;

const style = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: space.block,
    borderRadius: radius.field,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    flexBasis: 0,
  },
  group: { flexDirection: 'row', gap: space.row },
  primary: { backgroundColor: colour.shuttle },
  quiet: { backgroundColor: colour.card, borderWidth: 1.5, borderColor: colour.line },
  danger: { backgroundColor: colour.card, borderWidth: 1.5, borderColor: colour.down },
  disabled: { backgroundColor: colour.raised, borderWidth: 0 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.85 },
  label: { ...font.body, fontWeight: '700', textAlign: 'center' },
  disabledLabel: { color: colour.dim },
});
