import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import type { GameRow } from '../../data/games';
import type { ProfileId } from '../../domain/types';
import { lineupOf } from '../game-row';
import { usePlayerGames, usePlayerSearch } from '../queries';
import { useMember } from '../session';
import { colour, font, layout, radius, space } from '../theme';

/** Enough recent faces to cover a session's regulars without becoming a list. */
const RECENTS_SHOWN = 8;

export interface Pickable {
  readonly profileId: ProfileId;
  readonly displayName: string;
}

/**
 * Who else played. Opens on the people the member played with most recently, because
 * a club of thirty keeps meeting the same handful, and falls back to searching the
 * whole club as soon as anything is typed.
 */
export function PlayerPicker({
  visible,
  taken,
  onPick,
  onClose,
}: {
  readonly visible: boolean;
  readonly taken: readonly ProfileId[];
  readonly onPick: (player: Pickable) => void;
  readonly onClose: () => void;
}) {
  const me = useMember();
  const [term, setTerm] = useState('');
  const invite = useMutation({ mutationFn: shareInvite });

  const found = usePlayerSearch(term);
  const played = usePlayerGames(me.id);

  const free = (player: Pickable) =>
    player.profileId !== me.id && !taken.includes(player.profileId);
  const recents = term.trim().length > 0 ? [] : recentPartners(played.data ?? [], me.id).filter(free);
  const others = (found.data ?? [])
    .map((profile) => ({ profileId: profile.id, displayName: profile.display_name }))
    .filter((player) => free(player) && !recents.some((recent) => recent.profileId === player.profileId));

  const sections = [
    { title: 'Played with recently', data: recents },
    { title: term.trim().length > 0 ? 'Matches' : 'Everyone', data: others },
  ].filter((section) => section.data.length > 0);

  const close = () => {
    setTerm('');
    invite.reset();
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={close}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <View style={[layout.screen, { backgroundColor: colour.deep, padding: space.page, gap: space.gap }]}>
        <View style={layout.spread}>
          <Text style={font.heading}>Add a player</Text>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={close}>
            <Text style={[font.body, { color: colour.accent }]}>Cancel</Text>
          </Pressable>
        </View>

        <View style={style.search}>
          <Ionicons color={colour.dim} name="search" size={18} />
          <TextInput
            accessibilityLabel="Search players"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onChangeText={setTerm}
            placeholder="Search by name"
            placeholderTextColor={colour.dim}
            style={[font.body, { flex: 1 }]}
            value={term}
          />
          {term.length === 0 ? null : (
            <Pressable accessibilityLabel="Clear search" hitSlop={12} onPress={() => setTerm('')}>
              <Ionicons color={colour.dim} name="close-circle" size={18} />
            </Pressable>
          )}
        </View>

        <SectionList
          ItemSeparatorComponent={() => <View style={layout.rule} />}
          ListEmptyComponent={
            found.isPending ? undefined : (
              <Text style={font.dim}>
                {`Nobody called "${term.trim()}". Everyone in a game needs an account, so send them the link below.`}
              </Text>
            )
          }
          ListFooterComponent={
            <View style={{ gap: space.tight, paddingVertical: space.gap }}>
              <Pressable accessibilityRole="button" onPress={() => invite.mutate()}>
                <Text style={[font.body, { color: colour.accent }]}>Invite someone new</Text>
              </Pressable>
              {invite.data === 'copied' ? (
                <Text style={font.dim}>Link copied. Send it to them.</Text>
              ) : null}
              {invite.isError ? (
                <Text style={[font.dim, { color: colour.down }]}>{invite.error.message}</Text>
              ) : null}
            </View>
          }
          keyExtractor={(player) => player.profileId}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setTerm('');
                onPick(item);
              }}
              style={({ pressed }) => [style.option, pressed ? { opacity: 0.6 } : null]}
            >
              <Text style={font.body}>{item.displayName}</Text>
            </Pressable>
          )}
          renderSectionHeader={({ section }) => (
            <Text style={[font.dim, style.header]}>{section.title}</Text>
          )}
          sections={sections}
          stickySectionHeadersEnabled={false}
          style={{ flex: 1 }}
        />
      </View>
    </Modal>
  );
}

/**
 * Story 11: the sign-up link, handed to the phone's own share sheet so it can go by
 * whatever app the friend uses, or copied where there is no share sheet.
 */
async function shareInvite(): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = `${window.location.origin}${process.env.EXPO_BASE_URL ?? ''}/sign-up`;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Join the badminton ladder', url });
      return 'shared';
    } catch (error) {
      // Closing the share sheet without sending is a choice, not a failure.
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      // Refused rather than cancelled: copying still gets the link to them.
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

/** Everyone the member has played with or against, most recently met first. */
function recentPartners(
  rows: readonly { readonly games: GameRow }[],
  meId: ProfileId,
): readonly Pickable[] {
  const newestFirst = [...rows].sort(
    (left, right) =>
      new Date(right.games.played_at).getTime() - new Date(left.games.played_at).getTime(),
  );

  const met = new Map<ProfileId, Pickable>();
  for (const { games: row } of newestFirst) {
    const { a, b } = lineupOf(row);
    for (const player of [...a, ...b]) {
      if (player.profileId === meId || met.has(player.profileId)) continue;
      met.set(player.profileId, {
        profileId: player.profileId,
        displayName: player.displayName,
      });
    }
  }

  return [...met.values()].slice(0, RECENTS_SHOWN);
}

const style = StyleSheet.create({
  option: { paddingVertical: space.gap },
  header: { paddingTop: space.gap, paddingBottom: space.tight },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.row,
    minHeight: 48,
    paddingHorizontal: space.gap,
    borderRadius: radius.field,
    backgroundColor: colour.raised,
  },
});
