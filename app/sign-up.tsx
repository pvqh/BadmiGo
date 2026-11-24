import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text } from 'react-native';
import { signUp } from '../src/data/auth';
import { Button } from '../src/ui/components/button';
import { Choice, Field } from '../src/ui/components/field';
import { useUsernameCheck } from '../src/ui/queries';
import { colour, font, layout } from '../src/ui/theme';

/** Matches minimum_password_length in supabase/config.toml. */
const MIN_PASSWORD = 8;

type Kind = 'username' | 'email';

export default function SignUp() {
  const [kind, setKind] = useState<Kind>('username');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');

  const check = useUsernameCheck(kind === 'username' ? handle : '');
  const signingUp = useMutation({ mutationFn: () => signUp(handle, password) });

  const handleReady =
    kind === 'username'
      ? check.isSuccess && check.data === null
      : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(handle.trim());

  return (
    <KeyboardAvoidingView behavior="padding" style={layout.screen}>
      <ScrollView contentContainerStyle={layout.page} keyboardShouldPersistTaps="handled">
        <Text style={font.dim}>
          Four players confirm every game, so sign up with whatever name the club knows you
          by.
        </Text>

        <Choice
          onChange={setKind}
          options={[
            { value: 'username', label: 'Username' },
            { value: 'email', label: 'Email' },
          ]}
          value={kind}
        />

        {kind === 'username' ? (
          <Field
            autoCapitalize="none"
            autoCorrect={false}
            hint="No email means no password reset — an admin would have to step in."
            label="Username"
            onChangeText={setHandle}
            placeholder="HungDepTrai01"
            problem={check.isError ? check.error.message : (check.data ?? null)}
            value={handle}
          />
        ) : (
          <Field
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            label="Email"
            onChangeText={setHandle}
            placeholder="email@example.com"
            value={handle}
          />
        )}

        <Field
          autoCapitalize="none"
          //autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD} characters.`}
          label="Password"
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••••••••••"
          value={password}
        />

        {signingUp.isError ? (
          <Text style={[font.dim, { color: colour.down }]}>{signingUp.error.message}</Text>
        ) : null}

        <Button
          busy={signingUp.isPending}
          disabled={!handleReady || password.length < MIN_PASSWORD}
          label="Create account"
          onPress={() => signingUp.mutate()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
