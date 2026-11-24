import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LadderEntry } from '../../data/ladder';
import type { ProfileId } from '../../domain/types';
import { colour, font, radius, space } from '../theme';
import { Avatar } from './avatar';
import { TierBadge } from './badge';

/** Gold is the shuttle's yellow, so first place wears the app's own colour. */
const MEDAL = [colour.shuttle, '#E6ECE8', '#E8A26A'] as const;
const STEP_HEIGHT = [88, 62, 44] as const;
const AVATAR_SIZE = [64, 54, 54] as const;

/** Silver on the left and bronze on the right, the way a real podium stands. */
const PODIUM_ORDER = [1, 0, 2] as const;

/**
 * The top three, raised out of the list onto the court so the head of the ladder
 * reads at a glance. Their rise is the app's one entrance animation.
 */
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
        return entry === undefined ? (
          <View key={place} style={style.spot} />
        ) : (
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
      accessibilityLabel={`Hạng ${place + 1}, ${name}, ${entry.display_rating} điểm`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [style.spot, pressed ? style.pressed : null]}
    >
      <Avatar name={name} path={entry.profiles.avatar_path} ring={medal} size={AVATAR_SIZE[place]} />
      <Text numberOfLines={1} style={[font.body, style.name, mine ? { color: colour.shuttle } : null]}>
        {mine ? 'Bạn' : name}
      </Text>
      <TierBadge tier={entry.tier} />
      <View style={[style.step, { height: STEP_HEIGHT[place], borderTopColor: medal }]}>
        <Text style={[font.figure, style.rating]}>{entry.display_rating}</Text>
        <Text style={[font.dim, style.place]}>{`hạng ${place + 1}`}</Text>
      </View>
    </Pressable>
  );
}

const style = StyleSheet.create({
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.row,
  },
  spot: { flex: 1, alignItems: 'center', gap: space.tight },
  pressed: { transform: [{ scale: 0.96 }] },
  name: { color: colour.onCourt, fontWeight: '700', maxWidth: '100%' },
  step: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
    borderTopWidth: 4,
    borderTopLeftRadius: radius.field,
    borderTopRightRadius: radius.field,
  },
  rating: { color: colour.onCourt, fontSize: 26, lineHeight: 28 },
  place: { color: colour.onCourtDim, fontSize: 12 },
});
