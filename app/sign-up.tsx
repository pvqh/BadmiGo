import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text } from 'react-native';
import { signUp } from '../src/data/auth';
import { MIN_PASSWORD } from '../src/data/function-contract';
import { Button } from '../src/ui/components/button';
import { Field } from '../src/ui/components/field';
import { useUsernameCheck } from '../src/ui/queries';
import { colour, font, layout } from '../src/ui/theme';

/** Matches minimum_password_length in supabase/config.toml. */

export default function SignUp() {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');

  const check = useUsernameCheck(handle);
  const signingUp = useMutation({ mutationFn: () => signUp(handle, password) });

  const handleReady = check.isSuccess && check.data === null;

  return (
    <KeyboardAvoidingView behavior="padding" style={layout.screen}>
      <ScrollView contentContainerStyle={layout.page} keyboardShouldPersistTaps="handled">

        <Field
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          hint="Lower case, and yours for good. If you forget your password, an admin sets you a temporary one."
          label="Username"
          onChangeText={setHandle}
          placeholder="HungDepTrai01"
          problem={check.isError ? check.error.message : (check.data ?? null)}
          value={handle}
        />

        <Field
          autoCapitalize="none"
          //autoComplete="new-password"
          hint={`Ít nhất ${MIN_PASSWORD} ký tự.`}
          label="Password"
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
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
