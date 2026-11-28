import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { readMembers, runAdminAction, setAdmin } from '../data/admin';
import type { AdminAction } from '../data/function-contract';
import {
  answerGame,
  FEED_PAGE,
  logGame,
  readFeed,
  readGame,
  readGamesFor,
  readDisputedGames,
  readMyPendingGames,
  Refused,
  searchFeed,
  type FeedCursor,
  type FeedSearch,
  type Answer,
} from '../data/games';
import {
  readLadder,
  readPlayer,
  readRating,
  readRatingHistory,
  readReplayState,
  readStrengths,
  searchPlayers,
} from '../data/ladder';
import { changeDisplayName, usernameAvailable, usernameProblem } from '../data/auth';
import { changeAvatar, uploadAvatar } from '../data/avatar';
import {
  pushState,
  readPreferences,
  turnOffPush,
  turnOnPush,
  updatePreferences,
  type Preferences,
} from '../data/notifications';
import type { ProfileId } from '../domain/types';

/**
 * Every query key in the app, in one place, so a mutation that has to invalidate one
 * cannot spell it differently from the screen that reads it.
 */
export const keys = {
  profile: ['profile'] as const,
  myUsername: ['my-username'] as const,
  ladder: ['ladder'] as const,
  strengths: ['strengths'] as const,
  feed: ['feed'] as const,
  feedSearch: (search: FeedSearch) => ['feed', 'search', search.term, search.day] as const,
  replay: ['replay'] as const,
  pending: (profileId: ProfileId) => ['pending', profileId] as const,
  game: (gameId: string) => ['game', gameId] as const,
  playerGames: (profileId: ProfileId) => ['player-games', profileId] as const,
  player: (profileId: ProfileId) => ['player', profileId] as const,
  rating: (profileId: ProfileId) => ['rating', profileId] as const,
  history: (profileId: ProfileId) => ['history', profileId] as const,
  search: (term: string) => ['search', term] as const,
  username: (handle: string) => ['username', handle] as const,
  preferences: (profileId: ProfileId) => ['preferences', profileId] as const,
  push: ['push'] as const,
  members: ['members'] as const,
  disputed: ['disputed'] as const,
};

/**
 * Story 10: the reason a handle cannot be used, while it is being typed, so signup
 * never fails at the last step. The problem comes back as a sentence because the
 * rule lives in SQL and only it knows which rule was broken.
 */
export function useUsernameCheck(username: string) {
  const handle = username.trim();
  return useQuery({
    queryKey: keys.username(handle),
    queryFn: async () => {
      const problem = await usernameProblem(handle);
      if (problem !== null) return problem;
      return (await usernameAvailable(handle)) ? null : `${handle} đã có người dùng`;
    },
    enabled: handle.length > 0,
  });
}

export function useLadder() {
  return useQuery({ queryKey: keys.ladder, queryFn: readLadder });
}

export function useStrengths() {
  return useQuery({ queryKey: keys.strengths, queryFn: readStrengths });
}

/** Story 43 reaches back past the last session, so the feed pages as it is scrolled. */
export function useFeed() {
  return useInfiniteQuery({
    queryKey: keys.feed,
    queryFn: ({ pageParam }) => readFeed(pageParam),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (page): FeedCursor | null => {
      const last = page.at(-1);
      return page.length < FEED_PAGE || last === undefined
        ? null
        : { playedAt: last.played_at, id: last.id };
    },
  });
}

/** Story 46a. Off until a name or a day is given; the plain feed covers the empty case. */
export function useFeedSearch(term: string, day: string | null) {
  const search = { term: term.trim(), day };
  return useQuery({
    queryKey: keys.feedSearch(search),
    queryFn: () => searchFeed(search),
    enabled: search.term.length > 0 || day !== null,
  });
}

export function useReplayState() {
  return useQuery({ queryKey: keys.replay, queryFn: readReplayState });
}

export function usePendingGames(profileId: ProfileId) {
  return useQuery({
    queryKey: keys.pending(profileId),
    queryFn: () => readMyPendingGames(profileId),
  });
}

export function useGame(gameId: string) {
  return useQuery({ queryKey: keys.game(gameId), queryFn: () => readGame(gameId) });
}

export function usePlayerGames(profileId: ProfileId) {
  return useQuery({
    queryKey: keys.playerGames(profileId),
    queryFn: () => readGamesFor(profileId),
  });
}

export function usePlayer(profileId: ProfileId) {
  return useQuery({ queryKey: keys.player(profileId), queryFn: () => readPlayer(profileId) });
}

export function usePlayerRating(profileId: ProfileId) {
  return useQuery({ queryKey: keys.rating(profileId), queryFn: () => readRating(profileId) });
}

export function useRatingHistory(profileId: ProfileId) {
  return useQuery({
    queryKey: keys.history(profileId),
    queryFn: () => readRatingHistory(profileId),
  });
}

/**
 * An empty term matches everyone, so the picker opens on the whole club rather than
 * on nothing — a new member has no recent partners to show instead.
 */
export function usePlayerSearch(term: string) {
  const trimmed = term.trim();
  return useQuery({ queryKey: keys.search(trimmed), queryFn: () => searchPlayers(trimmed) });
}

export function usePreferences(profileId: ProfileId) {
  return useQuery({
    queryKey: keys.preferences(profileId),
    queryFn: () => readPreferences(profileId),
  });
}

/** Whether this phone receives notifications; a property of the browser, not the member. */
export function usePushState() {
  return useQuery({ queryKey: keys.push, queryFn: pushState });
}

export function useSetPush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) => (on ? turnOnPush() : turnOffPush()),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.push }),
  });
}

export function useMembers() {
  return useQuery({ queryKey: keys.members, queryFn: readMembers });
}

export function useDisputedGames() {
  return useQuery({ queryKey: keys.disputed, queryFn: readDisputedGames });
}

/**
 * Every admin action except a password reset ends in a replay that rewrites every
 * rating, so, as after a settling answer, nothing cached survives it.
 */
export function useAdminAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminAction) => runAdminAction(body),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useSetAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, isAdmin }: { profileId: ProfileId; isAdmin: boolean }) =>
      setAdmin(profileId, isAdmin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.members }),
  });
}

/** A new game moves no rating, so only the pending list can have changed. */
export function useLogGame(profileId: ProfileId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logGame,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.pending(profileId) }),
  });
}

/**
 * An answer that settles a game triggers a replay, and a replay rewrites every
 * rating in the club — so when the server says it replayed, nothing cached is still
 * trustworthy and all of it is dropped.
 */
export function useAnswerGame(profileId: ProfileId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ gameId, answer }: { gameId: string; answer: Answer }) =>
      answerGame(gameId, answer),
    onSuccess: async (outcome, variables) => {
      if (outcome.replayed) {
        await queryClient.invalidateQueries();
        return;
      }
      await queryClient.invalidateQueries({ queryKey: keys.pending(profileId) });
      await queryClient.invalidateQueries({ queryKey: keys.game(variables.gameId) });
    },
  });
}

/**
 * Story 78. One at a time through `confirm-game`, exactly as single taps would be, so
 * replays never overlap. A game settled by someone else since the list was drawn (a
 * 409) is skipped; any other failure stops the run and the ones already done stay done.
 */
export function useConfirmAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (gameIds: readonly string[]) => {
      for (const gameId of gameIds) {
        await answerGame(gameId, 'confirm').catch((error: unknown) => {
          if (!(error instanceof Refused && error.status === 409)) throw error;
        });
      }
    },
    onSettled: () => queryClient.invalidateQueries(),
  });
}

/** A name shows on the ladder, the feed and every game, so nothing cached survives it. */
export function useChangeDisplayName(profileId: ProfileId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) => changeDisplayName(profileId, displayName),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/**
 * Story 6b, from Settings. Null takes the picture away. A picture shows on the ladder
 * and every profile, so, like a name, it leaves nothing cached behind.
 */
export function useChangeAvatar(profileId: ProfileId, previous: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (picture: Blob | null) =>
      changeAvatar({
        profileId,
        previous,
        next: picture === null ? null : await uploadAvatar(picture),
      }),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useUpdatePreferences(profileId: ProfileId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: Parameters<typeof updatePreferences>[1]) =>
      updatePreferences(profileId, changes),
    onMutate: (changes) => {
      queryClient.setQueryData<Preferences>(keys.preferences(profileId), (current) =>
        current === undefined ? current : { ...current, ...changes },
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: keys.preferences(profileId) }),
  });
}
