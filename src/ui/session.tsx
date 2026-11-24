import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { myProfile, onAuthChange, type Profile } from '../data/auth';
import { keys } from './queries';

/**
 * Who is using the app, as the four states the router actually branches on. An
 * account can exist without a profile — signing up creates the first, and the
 * profile step that follows makes the second — and "needs-profile" is that gap, not an error.
 */
export type SessionStatus =
  | 'loading'
  | 'signed-out'
  | 'needs-profile'
  | 'member'
  | 'unavailable';

interface Session {
  readonly status: SessionStatus;
  readonly profile: Profile | null;
  readonly problem: string | null;
  readonly retry: () => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { readonly children: ReactNode }) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(
    () =>
      onAuthChange((next) => {
        setUserId(next);
        // Nothing cached survives a sign-out: the next member must not see it.
        if (next === null) queryClient.clear();
      }),
    [queryClient],
  );

  const profile = useQuery({
    queryKey: [...keys.profile, userId],
    queryFn: myProfile,
    enabled: typeof userId === 'string',
    staleTime: Infinity,
  });

  const value: Session = {
    status: statusOf(userId, profile.isPending, profile.isError, profile.data),
    profile: profile.data ?? null,
    problem: profile.error === null ? null : profile.error.message,
    retry: () => void profile.refetch(),
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (session === null) {
    throw new Error('useSession was called outside the SessionProvider');
  }
  return session;
}

/**
 * The signed-in member, for the screens the router only mounts once there is one.
 * Throwing here would mean the gate in app/_layout.tsx had let someone through.
 */
export function useMember(): Profile {
  const { profile } = useSession();
  if (profile === null) {
    throw new Error('a member screen was mounted without a profile');
  }
  return profile;
}

function statusOf(
  userId: string | null | undefined,
  isPending: boolean,
  isError: boolean,
  profile: Profile | null | undefined,
): SessionStatus {
  if (userId === undefined) return 'loading';
  if (userId === null) return 'signed-out';
  if (isError) return 'unavailable';
  if (isPending || profile === undefined) return 'loading';
  return profile === null ? 'needs-profile' : 'member';
}
