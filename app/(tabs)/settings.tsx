import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { changePassword, signOut } from '../../src/data/auth';
import type { Preferences } from '../../src/data/notifications';
import { Pending, Problem } from '../../src/ui/components/async';
import { Button } from '../../src/ui/components/button';
import { Field } from '../../src/ui/components/field';
import { usePreferences, useUpdatePreferences } from '../../src/ui/queries';
import { useMember } from '../../src/ui/session';
import { colour, font, layout, space } from '../../src/ui/theme';

const MIN_PASSWORD = 8;

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

export default function Settings() {
  const me = useMember();
  const preferences = usePreferences(me.id);
  const update = useUpdatePreferences(me.id);

  const [password, setPassword] = useState('');
  const changing = useMutation({
    mutationFn: () => changePassword(password),
    onSuccess: () => setPassword(''),
  });
  const leaving = useMutation({ mutationFn: signOut });

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
        {NOTIFICATIONS.map(({ key, label }) => (
          <View key={key} style={layout.spread}>
            <Text style={[font.body, { flex: 1 }]}>{label}</Text>
            <Switch
              onValueChange={(value) => update.mutate({ [key]: value })}
              thumbColor={colour.text}
              trackColor={{ true: colour.accent, false: colour.line }}
              value={current[key]}
            />
          </View>
        ))}
        <Text style={font.dim}>
          Being passed on the ladder is off unless you ask for it. The recap and that
          alert have nowhere to send from yet — the preference is saved, the sender is
          not built.
        </Text>
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
          <Text style={[font.dim, { color: colour.up }]}>Changed.</Text>
        ) : null}
        <Button
          busy={changing.isPending}
          disabled={password.length < MIN_PASSWORD}
          label="Lưu"
          onPress={() => changing.mutate()}
        />
      </View>

      <View style={{ gap: space.row }}>
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
