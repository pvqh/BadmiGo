import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LadderEntry } from '../../data/ladder';
import type { ProfileId } from '../../domain/types';
import { colour, font, radius, space } from '../theme';
import { TierBadge } from './badge';

const MEDAL = [colour.accent, '#d4dde2', '#d08c5a'] as const;
const STEP_HEIGHT = [96, 68, 48] as const;

/** Silver on the left and bronze on the right, the way a real podium stands. */
const PODIUM_ORDER = [1, 0, 2] as const;

/** The top three, raised out of the list so the head of the ladder reads at a glance. */
export function Podium({
  leaders,
  myId,
  onOpen,
}: {
  readonly leaders: readonly LadderEntry[];
  readonly myId: ProfileId;
  readonly onOpen: (profileId: ProfileId) => void;
}) {
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(rise, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  }, [rise]);

  const lift = {
    opacity: rise,
    transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
  };

  return (
    <Animated.View style={[style.podium, lift]}>
      {PODIUM_ORDER.map((place) => {
        const entry = leaders[place];
        return entry === undefined ? null : (
          <Spot
            entry={entry}
            key={entry.profile_id}
            mine={entry.profile_id === myId}
            onPress={() => onOpen(entry.profile_id)}
            place={place}
          />
        );
      })}
    </Animated.View>
  );
}

function Spot({
  entry,
  place,
  mine,
  onPress,
}: {
  readonly entry: LadderEntry;
  readonly place: 0 | 1 | 2;
  readonly mine: boolean;
  readonly onPress: () => void;
}) {
  const medal = MEDAL[place];
  const name = entry.profiles.display_name;

  return (
    <Pressable
      accessibilityLabel={`Hạng ${place + 1}, ${name}, ${entry.display_rating}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [style.spot, pressed ? style.pressed : null]}
    >
      {place === 0 ? <MaterialCommunityIcons color={medal} name="crown" size={28} /> : null}
      <View style={[style.avatar, { borderColor: medal }]}>
        <Text style={[style.initial, { color: medal }]}>{name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text numberOfLines={1} style={[font.heading, mine ? { color: colour.accent } : null]}>
        {name}
      </Text>
      <Text style={[font.figure, { color: medal }]}>{entry.display_rating}</Text>
      <TierBadge tier={entry.tier} />
      <View style={[style.step, { height: STEP_HEIGHT[place], borderTopColor: medal }]}>
        <Text style={[font.score, { color: medal }]}>{place + 1}</Text>
      </View>
    </Pressable>
  );
}

const style = StyleSheet.create({
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.tight,
    paddingTop: space.row,
  },
  spot: { flex: 1, alignItems: 'center', gap: space.tight },
  pressed: { transform: [{ scale: 0.96 }] },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colour.raised,
  },
  initial: { fontSize: 24, fontWeight: '700' },
  step: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.tight,
    backgroundColor: colour.card,
    borderTopWidth: 4,
    borderTopLeftRadius: radius.field,
    borderTopRightRadius: radius.field,
  },
});
