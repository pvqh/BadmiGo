import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import type { Member } from '../../src/data/admin';
import { MIN_PASSWORD } from '../../src/data/function-contract';
import { TIERS } from '../../src/domain/types';
import { Nothing, Pending, Problem } from '../../src/ui/components/async';
import { Button, ButtonRow } from '../../src/ui/components/button';
import { Choice, Field } from '../../src/ui/components/field';
import { useAdminAction, useMembers, useSetAdmin } from '../../src/ui/queries';
import { useMember } from '../../src/ui/session';
import { colour, font, layout, space } from '../../src/ui/theme';
import { TIER_LABEL } from '../../src/ui/vocabulary';

/** Matches minimum_password_length in supabase/config.toml. */

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

  if (members.isPending) return <Pending />;
  if (members.isError) {
    return <Problem message={members.error.message} onRetry={() => void members.refetch()} />;
  }

  const member = members.data.find((candidate) => candidate.id === id);
  if (member === undefined) return <Nothing message="This account no longer exists." />;

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
      {act.isSuccess ? <Text style={[font.dim, { color: colour.up }]}>Done.</Text> : null}

      <View style={layout.card}>
        <Text style={font.heading}>Seed tier</Text>
        <Choice
          onChange={(seedTier) => act.mutate({ action: 'set-seed-tier', profileId: member.id, seedTier })}
          options={TIERS.map((tier) => ({ value: tier, label: TIER_LABEL[tier] }))}
          value={member.seed_tier}
        />
        <Text style={font.dim}>
          Where their rating started. Changing it replays the whole club, so every rating
          since moves with it.
        </Text>
      </View>

      <View style={layout.card}>
        <View style={layout.spread}>
          <Text style={[font.heading, { flex: 1 }]}>Admin</Text>
          <Switch
            disabled={promote.isPending || member.id === me.id}
            onValueChange={(isAdmin) => promote.mutate({ profileId: member.id, isAdmin })}
            thumbColor={colour.text}
            trackColor={{ true: colour.accent, false: colour.line }}
            value={member.is_admin}
          />
        </View>
        <Text style={font.dim}>
          {member.id === me.id
            ? 'Another admin has to take this away from you, so the club is never left without one.'
            : 'Admins can fix scores, remove games and change accounts.'}
        </Text>
        {promote.isError ? (
          <Text style={[font.dim, { color: colour.down }]}>{promote.error.message}</Text>
        ) : null}
      </View>

      <View style={layout.card}>
        <Text style={font.heading}>Temporary password</Text>
        <Field
          autoCapitalize="none"
          autoCorrect={false}
          hint={`At least ${MIN_PASSWORD} characters. Tell them in person; they change it in Settings.`}
          label="New password"
          onChangeText={setPassword}
          value={password}
        />
        <Button
          busy={act.isPending}
          disabled={password.length < MIN_PASSWORD}
          label="Set password"
          onPress={() =>
            act.mutate(
              { action: 'reset-password', profileId: member.id, password },
              { onSuccess: () => setPassword('') },
            )
          }
        />
      </View>

      <View style={layout.card}>
        <Text style={font.heading}>Duplicate account</Text>
        <Text style={font.dim}>
          If this is a second account for someone, merge it into the one they keep. Its
          games move across and this account is deleted.
        </Text>
        {keep === null ? (
          <>
            <Field
              autoCapitalize="none"
              autoCorrect={false}
              label="The account they keep"
              onChangeText={setSearch}
              placeholder="Search by name"
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
              Merge @{member.username} into @{keep.username}? This cannot be undone.
            </Text>
            <ButtonRow>
              <Button
                busy={act.isPending}
                label="Merge"
                onPress={() =>
                  act.mutate(
                    { action: 'merge', keepId: keep.id, mergeId: member.id },
                    { onSuccess: () => router.back() },
                  )
                }
                tone="danger"
              />
              <Button label="Not this one" onPress={() => setKeep(null)} tone="quiet" />
            </ButtonRow>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
