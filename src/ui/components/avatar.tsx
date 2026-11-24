import { Image, StyleSheet, Text, View } from 'react-native';
import { avatarUrl } from '../../data/avatar';
import { colour, font, radius } from '../theme';

/**
 * Story 6b: a member's picture, or the first letter of their name when they have
 * none. `uri` is for a picture not uploaded yet, previewed while signing up.
 */
export function Avatar({
  name,
  path,
  uri,
  size,
  ring,
}: {
  readonly name: string;
  readonly path?: string | null;
  readonly uri?: string | null;
  readonly size: number;
  /** A medal on the podium, or nothing. */
  readonly ring?: string;
}) {
  const source = uri ?? (path === null || path === undefined ? null : avatarUrl(path));
  const frame = {
    width: size,
    height: size,
    borderRadius: radius.pill,
    borderWidth: ring === undefined ? 0 : Math.max(2, Math.round(size / 18)),
    borderColor: ring,
  };

  if (source !== null) {
    return <Image accessibilityIgnoresInvertColors source={{ uri: source }} style={[style.picture, frame]} />;
  }

  return (
    <View style={[style.placeholder, frame]}>
      <Text style={[style.initial, { fontSize: Math.round(size * 0.42), color: ring ?? colour.courtInk }]}>
        {initialOf(name)}
      </Text>
    </View>
  );
}

/** By code point, so a name that starts outside the basic plane is not cut in half. */
function initialOf(name: string): string {
  return (Array.from(name.trim())[0] ?? '?').toUpperCase();
}

const style = StyleSheet.create({
  picture: { backgroundColor: colour.raised },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colour.courtSoft,
  },
  initial: { ...font.figure },
});
