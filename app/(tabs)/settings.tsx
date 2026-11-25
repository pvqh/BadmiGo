import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { changePassword, signOut } from '../../src/data/auth';
import { MIN_PASSWORD } from '../../src/data/function-contract';
import { turnOffPush, type Preferences, type PushState } from '../../src/data/notifications';
import { Pending, Problem } from '../../src/ui/components/async';
import { AvatarPicker } from '../../src/ui/components/avatar-picker';
import { Button } from '../../src/ui/components/button';
import { Choice, Field } from '../../src/ui/components/field';
import { ScreenTitle } from '../../src/ui/components/screen-title';
import {
  useChangeAvatar,
  useChangeDisplayName,
  usePreferences,
  usePushState,
  useSetPush,
  useUpdatePreferences,
} from '../../src/ui/queries';
import { useMember } from '../../src/ui/session';
import { chooseScheme, colour, font, layout, scheme, space } from '../../src/ui/theme';

/** The profiles table's own limit, so the box stops where the database would refuse. */
const DISPLAY_NAME_MAX = 40;

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
  'needs-install': '',
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
  const setPush = useSetPush();

  const [displayName, setDisplayName] = useState(me.display_name);
  const renaming = useChangeDisplayName(me.id);
  const picturing = useChangeAvatar(me.id, me.avatar_path);

  const [password, setPassword] = useState('');
  const changing = useMutation({
    mutationFn: () => changePassword(password),
    onSuccess: () => setPassword(''),
  });
  // This phone stops receiving the member's notifications before it forgets them. A
  // failed clean-up must not trap anyone in the account; a dead address is dropped
  // the first time the push service reports it gone.
  const leaving = useMutation({
    mutationFn: async () => {
      try {
        await turnOffPush();
      } finally {
        await signOut();
      }
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
      <ScreenTitle title="Cài đặt" />

      <View style={layout.card}>
        <Text style={font.heading}>Ảnh đại diện</Text>
        <AvatarPicker
          busy={picturing.isPending}
          name={me.display_name}
          onChoose={(picture) => picturing.mutate(picture)}
          onRemove={() => picturing.mutate(null)}
          path={me.avatar_path}
        />
        {picturing.isError ? (
          <Text style={[font.dim, { color: colour.down }]}>{picturing.error.message}</Text>
        ) : null}
      </View>

      <View style={layout.card}>
        <Text style={font.heading}>Giao diện</Text>
        <Choice
          onChange={chooseScheme}
          options={[
            { value: 'light', label: 'Sáng' },
            { value: 'dark', label: 'Tối' },
          ]}
          value={scheme}
        />
      </View>

      <View style={layout.card}>
        <Text style={font.heading}>Tên hiển thị</Text>
        <Field
          label="Tên mới"
          maxLength={DISPLAY_NAME_MAX}
          onChangeText={setDisplayName}
          value={displayName}
        />
        {renaming.isError ? (
          <Text style={[font.dim, { color: colour.down }]}>{renaming.error.message}</Text>
        ) : null}
        {renaming.isSuccess && displayName.trim() === me.display_name ? (
          <Text style={[font.dim, { color: colour.up }]}>Đã đổi.</Text>
        ) : null}
        <Button
          busy={renaming.isPending}
          disabled={displayName.trim().length === 0 || displayName.trim() === me.display_name}
          label="Lưu"
          onPress={() => renaming.mutate(displayName)}
        />
      </View>

      <View style={layout.card}>
        <Text style={font.heading}>Thông báo</Text>
        {push.data === 'off' || push.data === 'on' ? (
          <View style={layout.spread}>
            <Text style={[font.body, { flex: 1 }]}>Nhận thông báo trên máy này</Text>
            <Switch
              disabled={setPush.isPending}
              onValueChange={(on) => setPush.mutate(on)}
              thumbColor={colour.onCourt}
              trackColor={{ true: colour.court, false: colour.switchOff }}
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
          <View key={key} style={[layout.spread, { minHeight: 44 }]}>
            <Text style={[font.body, { flex: 1 }]}>{label}</Text>
            <Switch
              accessibilityLabel={label}
              onValueChange={(value) => update.mutate({ [key]: value })}
              thumbColor={colour.onCourt}
              trackColor={{ true: colour.court, false: colour.switchOff }}
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
          <Link href="/admin" style={[font.body, { color: colour.courtInk, fontWeight: '600' }]}>
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
