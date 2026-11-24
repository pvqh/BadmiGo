import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  answerGame,
  logGame,
  readFeed,
  readGame,
  readGamesFor,
  readMyPendingGames,
  type Answer,
} from '../data/games';
import {
  readLadder,
  readRating,
  readRatingHistory,
  readReplayState,
  readStrengths,
  searchPlayers,
} from '../data/ladder';
import { usernameAvailable, usernameProblem } from '../data/auth';
import { readPreferences, updatePreferences, type Preferences } from '../data/notifications';
import type { ProfileId } from '../domain/types';

/**
 * Every query key in the app, in one place, so a mutation that has to invalidate one
 * cannot spell it differently from the screen that reads it.
 */
export const keys = {
  profile: ['profile'] as const,
  reserved: ['reserved-username'] as const,
  ladder: ['ladder'] as const,
  strengths: ['strengths'] as const,
  feed: ['feed'] as const,
  replay: ['replay'] as const,
  pending: (profileId: ProfileId) => ['pending', profileId] as const,
  game: (gameId: string) => ['game', gameId] as const,
  playerGames: (profileId: ProfileId) => ['player-games', profileId] as const,
  rating: (profileId: ProfileId) => ['rating', profileId] as const,
  history: (profileId: ProfileId) => ['history', profileId] as const,
  search: (term: string) => ['search', term] as const,
  username: (handle: string) => ['username', handle] as const,
  preferences: (profileId: ProfileId) => ['preferences', profileId] as const,
};

/**
 * Story 10: the reason a handle cannot be used, while it is being typed, so signup
 * never fails at the last step. The problem comes back as a sentence because the
 * rule lives in SQL and only it knows which rule was broken.
 */
export function useUsernameCheck(username: string) {
  const handle = username.trim().toLowerCase();
  return useQuery({
    queryKey: keys.username(handle),
    queryFn: async () => {
      const problem = await usernameProblem(handle);
      if (problem !== null) return problem;
      return (await usernameAvailable(handle)) ? null : `${handle} is already taken`;
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

export function useFeed() {
  return useQuery({ queryKey: keys.feed, queryFn: () => readFeed() });
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
