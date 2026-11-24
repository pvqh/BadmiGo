import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { changePassword, signOut } from '../../src/data/auth';
import { MIN_PASSWORD } from '../../src/data/function-contract';
import { turnOffPush, type Preferences, type PushState } from '../../src/data/notifications';
import { Pending, Problem } from '../../src/ui/components/async';
import { Button } from '../../src/ui/components/button';
import { Field } from '../../src/ui/components/field';
import {
  usePreferences,
  usePushState,
  useSetPush,
  useUpdatePreferences,
} from '../../src/ui/queries';
import { useMember } from '../../src/ui/session';
import { colour, font, layout, space } from '../../src/ui/theme';


type Switchable = keyof Pick<
  Preferences,
  'confirmation_requests' | 'dispute_alerts' | 'weekly_recap' | 'overtaken_on_ladder'
>;

const NOTIFICATIONS: readonly { readonly key: Switchable; readonly label: string }[] = [
  { key: 'confirmation_requests', label: 'Có trận đấu cần được tôi xác nhận' },
  { key: 'dispute_alerts', label: 'Trận đấu tôi đã chơi bị bác bỏ' },
  { key: 'weekly_recap', label: 'Tóm tắt cuối tuần' },
  { key: 'overtaken_on_ladder', label: 'Có người vượt qua tôi trong bảng xếp hạng' },
];

const PUSH_UNAVAILABLE: Record<Exclude<PushState, 'off' | 'on'>, string> = {
  'needs-install':
    'Hãy thêm ứng dụng vào màn hình chính trước; iPhone chỉ gửi thông báo khi mở ứng dụng từ đó.',
  blocked:
    'Thông báo đang bị chặn cho trang này. Hãy cho phép trong cài đặt của điện thoại.',
  unsupported:
    'Trình duyệt này không nhận được thông báo. Biểu ngữ trên bảng xếp hạng vẫn hiện các trận đang chờ bạn.',
};

export default function Settings() {
  const me = useMember();
  const preferences = usePreferences(me.id);
  const update = useUpdatePreferences(me.id);
  const push = usePushState();
  const setPush = useSetPush(me.id);

  const [password, setPassword] = useState('');
  const changing = useMutation({
    mutationFn: () => changePassword(password),
    onSuccess: () => setPassword(''),
  });
  // This phone stops receiving the member's notifications before it forgets them.
  const leaving = useMutation({
    mutationFn: async () => {
      await turnOffPush();
      await signOut();
    },
  });

  if (preferences.isPending) return <Pending />;
  if (preferences.isError) {
    return (
      <Problem
        message={preferences.error.message}
        onRetry={() => void preferences.refetch()}
      />
    );
  }

  const current = preferences.data;

  return (
    <ScrollView contentContainerStyle={layout.page} style={layout.screen}>

      <View style={layout.card}>
        <Text style={font.heading}>Thông báo</Text>
        {push.data === 'off' || push.data === 'on' ? (
          <View style={layout.spread}>
            <Text style={[font.body, { flex: 1 }]}>Nhận thông báo trên máy này</Text>
            <Switch
              disabled={setPush.isPending}
              onValueChange={(on) => setPush.mutate(on)}
              thumbColor={colour.text}
              trackColor={{ true: colour.accent, false: colour.line }}
              value={push.data === 'on'}
            />
          </View>
        ) : push.data === undefined ? null : (
          <Text style={font.dim}>{PUSH_UNAVAILABLE[push.data]}</Text>
        )}
        {setPush.isError ? (
          <Text style={[font.dim, { color: colour.down }]}>{setPush.error.message}</Text>
        ) : null}
        {NOTIFICATIONS.map(({ key, label }) => (
          <View key={key} style={layout.spread}>
            <Text style={[font.body, { flex: 1 }]}>{label}</Text>
            <Switch
            
              onValueChange={(value) => update.mutate({ [key]: value })}
              style={ { marginBottom: space.row, transform: [{ scale: 1.4 }] }}
              thumbColor={colour.text}
              trackColor={{ true: colour.accent, false: colour.line }}
              value={current[key]}
            />
          </View>
        ))}
       
      </View>

      <View style={layout.card}>
        <Text style={font.heading}>Đổi mật khẩu</Text>
        <Field
          autoCapitalize="none"
          autoComplete="new-password"
          hint={`Ít nhất ${MIN_PASSWORD} ký tự.`}
          label="Mật khẩu mới"
          onChangeText={setPassword}
          secureTextEntry
          value={password}
        />
        {changing.isError ? (
          <Text style={[font.dim, { color: colour.down }]}>{changing.error.message}</Text>
        ) : null}
        {changing.isSuccess ? (
          <Text style={[font.dim, { color: colour.up }]}>Đã đổi.</Text>
        ) : null}
        <Button
          busy={changing.isPending}
          disabled={password.length < MIN_PASSWORD}
          label="Lưu"
          onPress={() => changing.mutate()}
        />
      </View>

      {me.is_admin ? (
        <View style={layout.card}>
          <Text style={font.heading}>Quản trị</Text>
          <Link href="/admin" style={[font.body, { color: colour.accent }]}>
            Mở trang quản trị CLB
          </Link>
        </View>
      ) : null}

      <View style={{ gap: space.row }}>
        {leaving.isError ? (
          <Text style={[font.dim, { color: colour.down }]}>{leaving.error.message}</Text>
        ) : null}
        <Button
          busy={leaving.isPending}
          label="Đăng xuất"
          onPress={() => leaving.mutate()}
          tone="quiet"
        />
      </View>
    </ScrollView>
  );
}
