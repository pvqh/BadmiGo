import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import type { Member } from '../../src/data/admin';
import { MIN_PASSWORD } from '../../src/data/function-contract';
import { TIERS, type Tier } from '../../src/domain/types';
import { Nothing, Pending, Problem } from '../../src/ui/components/async';
import { Button, ButtonRow } from '../../src/ui/components/button';
import { Choice, Field } from '../../src/ui/components/field';
import { useAdminAction, useMembers, useSetAdmin } from '../../src/ui/queries';
import { useMember } from '../../src/ui/session';
import { colour, font, layout, space } from '../../src/ui/theme';
import { TIER_LABEL } from '../../src/ui/vocabulary';

/** One member's account, as only an admin can change it (stories 5, 68, 69, 72). */
export default function MemberAdmin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useMember();
  const members = useMembers();
  const act = useAdminAction();
  const promote = useSetAdmin();

  const [password, setPassword] = useState('');
  const [search, setSearch] = useState('');
  const [keep, setKeep] = useState<Member | null>(null);
  // A new seed tier replays the whole club, so a stray tap only proposes it.
  const [seedTier, setSeedTier] = useState<Tier | null>(null);

  if (members.isPending) return <Pending />;
  if (members.isError) {
    return <Problem message={members.error.message} onRetry={() => void members.refetch()} />;
  }

  const member = members.data.find((candidate) => candidate.id === id);
  if (member === undefined) return <Nothing message="Tài khoản này không còn nữa." />;

  const term = search.trim().toLowerCase();
  const others = members.data.filter(
    (other) =>
      other.id !== member.id &&
      term.length > 0 &&
      `${other.display_name} ${other.username}`.toLowerCase().includes(term),
  );

  return (
    <ScrollView
      contentContainerStyle={layout.page}
      keyboardShouldPersistTaps="handled"
      style={layout.screen}
    >
      <View>
        <Text style={font.title}>{member.display_name}</Text>
        <Text style={font.dim}>@{member.username}</Text>
      </View>

      {act.isError ? (
        <Text style={[font.dim, { color: colour.down }]}>{act.error.message}</Text>
      ) : null}
      {act.isSuccess ? <Text style={[font.dim, { color: colour.up }]}>Xong.</Text> : null}

      <View style={layout.card}>
        <Text style={font.heading}>Trình độ xuất phát</Text>
        <Choice
          onChange={(tier) => setSeedTier(tier === member.seed_tier ? null : tier)}
          options={TIERS.map((tier) => ({ value: tier, label: TIER_LABEL[tier] }))}
          value={seedTier ?? member.seed_tier}
        />
        {seedTier === null ? null : (
          <ButtonRow>
            <Button
              busy={act.isPending}
              label={`Đổi sang ${TIER_LABEL[seedTier]}`}
              onPress={() =>
                act.mutate(
                  { action: 'set-seed-tier', profileId: member.id, seedTier },
                  { onSuccess: () => setSeedTier(null) },
                )
              }
            />
            <Button label="Thôi" onPress={() => setSeedTier(null)} tone="quiet" />
          </ButtonRow>
        )}
        <Text style={font.dim}>
          Điểm xuất phát của người này. Đổi sẽ tính lại cả câu lạc bộ, nên mọi điểm từ đó
          đến nay đều thay đổi theo.
        </Text>
      </View>

      <View style={layout.card}>
        <View style={layout.spread}>
          <Text style={[font.heading, { flex: 1 }]}>Admin</Text>
          <Switch
            disabled={promote.isPending || member.id === me.id}
            onValueChange={(isAdmin) => promote.mutate({ profileId: member.id, isAdmin })}
            thumbColor={colour.onCourt}
            trackColor={{ true: colour.court, false: colour.switchOff }}
            value={member.is_admin}
          />
        </View>
        <Text style={font.dim}>
          {member.id === me.id
            ? 'Phải có admin khác gỡ quyền này của bạn, để câu lạc bộ luôn có admin.'
            : 'Admin có thể sửa tỉ số, gỡ trận và chỉnh tài khoản.'}
        </Text>
        {promote.isError ? (
          <Text style={[font.dim, { color: colour.down }]}>{promote.error.message}</Text>
        ) : null}
      </View>

      <View style={layout.card}>
        <Text style={font.heading}>Mật khẩu tạm</Text>
        <Field
          autoCapitalize="none"
          autoCorrect={false}
          hint={`Ít nhất ${MIN_PASSWORD} ký tự. Báo trực tiếp cho họ; họ tự đổi trong Cài đặt.`}
          label="Mật khẩu mới"
          onChangeText={setPassword}
          value={password}
        />
        <Button
          busy={act.isPending}
          disabled={password.length < MIN_PASSWORD}
          label="Đặt mật khẩu"
          onPress={() =>
            act.mutate(
              { action: 'reset-password', profileId: member.id, password },
              { onSuccess: () => setPassword('') },
            )
          }
        />
      </View>

      <View style={layout.card}>
        <Text style={font.heading}>Tài khoản trùng</Text>
        <Text style={font.dim}>
          Nếu đây là tài khoản thứ hai của ai đó, hãy gộp vào tài khoản họ giữ lại. Các
          trận được chuyển sang và tài khoản này bị xoá.
        </Text>
        {keep === null ? (
          <>
            <Field
              autoCapitalize="none"
              autoCorrect={false}
              label="Tài khoản giữ lại"
              onChangeText={setSearch}
              placeholder="Tìm theo tên"
              value={search}
            />
            {others.map((other) => (
              <Pressable accessibilityRole="button" key={other.id} onPress={() => setKeep(other)}>
                <Text style={font.body}>
                  {other.display_name} <Text style={font.dim}>@{other.username}</Text>
                </Text>
              </Pressable>
            ))}
          </>
        ) : (
          <View style={{ gap: space.row }}>
            <Text style={font.body}>
              Gộp @{member.username} vào @{keep.username}? Không thể hoàn tác.
            </Text>
            <ButtonRow>
              <Button
                busy={act.isPending}
                label="Gộp"
                onPress={() =>
                  act.mutate(
                    { action: 'merge', keepId: keep.id, mergeId: member.id },
                    { onSuccess: () => router.back() },
                  )
                }
                tone="danger"
              />
              <Button label="Không phải người này" onPress={() => setKeep(null)} tone="quiet" />
            </ButtonRow>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
