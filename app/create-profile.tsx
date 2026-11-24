import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { createMyProfile, reservedUsername, type Gender } from '../src/data/auth';
import type { Tier } from '../src/domain/types';
import { Pending } from '../src/ui/components/async';
import { Button } from '../src/ui/components/button';
import { Choice, Field } from '../src/ui/components/field';
import { keys, useUsernameCheck } from '../src/ui/queries';
import { colour, font, layout, space } from '../src/ui/theme';
import { TIER_LABEL, TIER_ORDER } from '../src/ui/vocabulary';

/**
 * The second half of signup, which every way in finishes with: a username, the name
 * the club calls you, which list you appear on, and the level you declare. A seed
 * tier only sets where the rating starts — the engine overrules it within a few
 * games — so this screen says so rather than making it feel decisive.
 */
export default function CreateProfile() {
  const queryClient = useQueryClient();
  const reserved = useQuery({ queryKey: keys.reserved, queryFn: reservedUsername });

  const [chosen, setChosen] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [seedTier, setSeedTier] = useState<Tier | null>(null);

  const locked = reserved.data ?? null;
  const username = locked ?? chosen;
  const check = useUsernameCheck(locked === null ? chosen : '');

  const creating = useMutation({
    mutationFn: (input: { gender: Gender; seedTier: Tier }) =>
      createMyProfile({
        username,
        displayName,
        gender: input.gender,
        seedTier: input.seedTier,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.profile }),
  });

  if (reserved.isPending) return <Pending />;

  const usernameReady = locked !== null || (check.isSuccess && check.data === null);
  const ready = usernameReady && displayName.trim().length > 0 && gender !== null && seedTier !== null;

  return (
    <KeyboardAvoidingView behavior="padding" style={layout.screen}>
      <ScrollView contentContainerStyle={layout.page} keyboardShouldPersistTaps="handled">
        <Field
          autoCapitalize="none"
          autoCorrect={false}
          editable={locked === null}
          hint={
            locked === null
              ? 'Lower case, and yours for good.'
              : 'Set when you created your account.'
          }
          label="Username"
          onChangeText={setChosen}
          problem={locked === null ? check.data ?? null : null}
          value={username}
        />

        <Field
          hint="What the ladder and the feed will call you."
          label="Display name"
          onChangeText={setDisplayName}
          placeholder="Nam"
          value={displayName}
        />

        <View style={{ gap: space.tight }}>
          <Text style={font.dim}>Which list you appear on</Text>
          <Choice
            onChange={setGender}
            options={[
              { value: 'male', label: "Men's" },
              { value: 'female', label: "Women's" },
            ]}
            value={gender}
          />
        </View>

        <View style={{ gap: space.tight }}>
          <Text style={font.dim}>Your level right now</Text>
          <Choice
            onChange={setSeedTier}
            options={TIER_ORDER.map((tier) => ({ value: tier, label: TIER_LABEL[tier] }))}
            value={seedTier}
          />
          <Text style={font.dim}>
            This only sets where you start. After five games the ladder decides for
            itself.
          </Text>
        </View>

        {creating.isError ? (
          <Text style={[font.dim, { color: colour.down }]}>{creating.error.message}</Text>
        ) : null}

        <Button
          busy={creating.isPending}
          disabled={!ready}
          label="Join the ladder"
          onPress={() => {
            if (gender === null || seedTier === null) return;
            creating.mutate({ gender, seedTier });
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
