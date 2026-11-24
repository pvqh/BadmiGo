import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Pending, Problem } from '../src/ui/components/async';
import { SessionProvider, useSession } from '../src/ui/session';
import { colour, font, scheme } from '../src/ui/theme';

/**
 * Thirty players and two sessions a week: a half-minute of staleness is invisible,
 * and one retry is enough for a phone that has walked out of the sports hall.
 */
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <SessionProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Routes />
        </SessionProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/**
 * The gate. Guards rather than redirects in an effect, so there is no frame in which
 * a signed-out phone has a club member's screen mounted. `home` is wherever the
 * current state belongs, which makes it the right answer for every group.
 */
function Routes() {
  const { status, profile, problem, retry } = useSession();

  if (status === 'loading') return <Pending />;
  if (status === 'unavailable') {
    return <Problem message={problem ?? 'Không kết nối được tới câu lạc bộ'} onRetry={retry} />;
  }

  const home =
    status === 'member' ? '/' : status === 'needs-profile' ? '/create-profile' : '/sign-in';

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colour.background },
        headerTintColor: colour.courtInk,
        headerTitleStyle: { ...font.heading },
        headerShadowVisible: false,
        // Arrow only: the screen behind is the tab group, whose route name is "(tabs)".
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colour.background },
      }}
    >
      <Stack.Protected guard={status === 'member'} redirectTo={home}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="game/[id]" options={{ title: 'Trận đấu' }} />
        <Stack.Screen name="player/[id]" options={{ title: '' }} />
        <Stack.Protected guard={profile?.is_admin === true}>
          <Stack.Screen name="admin/index" options={{ title: 'Quản trị CLB' }} />
          <Stack.Screen name="admin/[id]" options={{ title: 'Thành viên' }} />
        </Stack.Protected>
      </Stack.Protected>

      <Stack.Protected guard={status === 'needs-profile'} redirectTo={home}>
        <Stack.Screen name="create-profile" options={{ title: 'Hoàn tất đăng ký' }} />
      </Stack.Protected>

      <Stack.Protected guard={status === 'signed-out'} redirectTo={home}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ title: 'Tạo tài khoản' }} />
      </Stack.Protected>
    </Stack>
  );
}
