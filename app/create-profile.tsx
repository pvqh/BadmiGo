import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { createMyProfile, myUsername, signOut, type Gender } from '../src/data/auth';
import { uploadAvatar } from '../src/data/avatar';
import { TIERS, type Tier } from '../src/domain/types';
import { Pending, Problem } from '../src/ui/components/async';
import { AvatarPicker } from '../src/ui/components/avatar-picker';
import { Button } from '../src/ui/components/button';
import { Choice, Field } from '../src/ui/components/field';
import { keys } from '../src/ui/queries';
import { colour, font, layout, space } from '../src/ui/theme';
import { TIER_LABEL } from '../src/ui/vocabulary';

/**
 * The second half of signup: the name the club calls you, an optional picture, which
 * list you appear on, and the level you declare. The username was fixed when the
 * account was made. A seed tier only sets where the rating starts — the engine
 * overrules it within a few games — so this screen says so rather than making it feel
 * decisive. Someone who landed here on the wrong account can sign out and go back.
 */
export default function CreateProfile() {
  const queryClient = useQueryClient();
  const username = useQuery({ queryKey: keys.myUsername, queryFn: myUsername });

  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [seedTier, setSeedTier] = useState<Tier | null>(null);
  const [picture, setPicture] = useState<{ readonly blob: Blob; readonly preview: string } | null>(null);

  const creating = useMutation({
    mutationFn: async (input: { gender: Gender; seedTier: Tier }) =>
      createMyProfile({
        displayName,
        gender: input.gender,
        seedTier: input.seedTier,
        avatarPath: picture === null ? null : await uploadAvatar(picture.blob),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.profile }),
  });
  // Signing out is the way back: the gate then shows the sign-in screen.
  const leaving = useMutation({ mutationFn: signOut });

  if (username.isPending) return <Pending />;
  if (username.isError) {
    return <Problem message={username.error.message} onRetry={() => void username.refetch()} />;
  }

  const ready = displayName.trim().length > 0 && gender !== null && seedTier !== null;

  return (
    <KeyboardAvoidingView behavior="padding" style={layout.screen}>
      <ScrollView contentContainerStyle={layout.page} keyboardShouldPersistTaps="handled">
        <AvatarPicker
          name={displayName}
          onChoose={(blob) => setPicture({ blob, preview: URL.createObjectURL(blob) })}
          onRemove={() => setPicture(null)}
          uri={picture?.preview ?? null}
        />

        <Field
          editable={false}
          label="Tên đăng nhập"
          value={username.data}
        />

        <Field
          label="Tên hiển thị"
          onChangeText={setDisplayName}
          placeholder="Nam"
          value={displayName}
        />

        <View style={{ gap: space.tight }}>
          <Text style={[font.dim, { fontWeight: '600', color: colour.text }]}>Giới tính</Text>
          <Choice
            onChange={setGender}
            options={[
              { value: 'male', label: 'Nam' },
              { value: 'female', label: 'Nữ' },
            ]}
            value={gender}
          />
        </View>

        <View style={{ gap: space.tight }}>
          <Text style={[font.dim, { fontWeight: '600', color: colour.text }]}>Trình độ hiện tại</Text>
          <Choice
            onChange={setSeedTier}
            options={TIERS.map((tier) => ({ value: tier, label: TIER_LABEL[tier] }))}
            value={seedTier}
          />
          <Text style={font.dim}>
            Chọn đúng hoặc xấp xỉ trình độ thật của bạn. Sau năm trận đấu, bảng xếp hạng sẽ phân hạng lại trình độ của bạn.
          </Text>
        </View>

        {creating.isError ? (
          <Text style={[font.dim, { color: colour.down }]}>{creating.error.message}</Text>
        ) : null}

        <Button
          busy={creating.isPending}
          disabled={!ready}
          label="Tham gia bảng xếp hạng"
          onPress={() => {
            if (gender === null || seedTier === null) return;
            creating.mutate({ gender, seedTier });
          }}
        />

        {leaving.isError ? (
          <Text style={[font.dim, { color: colour.down }]}>{leaving.error.message}</Text>
        ) : null}
        <Button
          busy={leaving.isPending}
          label="Quay lại đăng nhập"
          onPress={() => leaving.mutate()}
          tone="quiet"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
