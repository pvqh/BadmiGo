import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { signIn } from '../src/data/auth';
import { Button } from '../src/ui/components/button';
import { Field } from '../src/ui/components/field';
import { colour, font, layout, space } from '../src/ui/theme';

export default function SignIn() {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');

  const signingIn = useMutation({ mutationFn: () => signIn(handle, password) });
  const ready = handle.trim().length > 0 && password.length > 0;

  return (
    <KeyboardAvoidingView behavior="padding" style={layout.screen}>
      <ScrollView contentContainerStyle={[layout.page, { paddingTop: space.block * 3 }]}>
        <Text style={font.title}>Badminton Ladder</Text>
        <Text style={font.dim}>Log your games. The ladder sorts itself out.</Text>

        <View style={{ height: space.block }} />

        <Field
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          label="Username or email"
          onChangeText={setHandle}
          placeholder="TrangXinhGai01"
          value={handle}
        />
        <Field
          autoCapitalize="none"
          autoComplete="current-password"
          label="Password"
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••••••••••"
          value={password}
        />

        {signingIn.isError ? (
          <Text style={[font.dim, { color: colour.down }]}>{signingIn.error.message}</Text>
        ) : null}

        <Button
          busy={signingIn.isPending}
          disabled={!ready}
          label="Sign in"
          onPress={() => signingIn.mutate()}
        />

        <View style={[layout.spread, { paddingTop: space.row }]}>
          <Link href="/sign-up" style={font.body}>
            Join the club
          </Link>
          <Link href="/reset-password" style={font.dim}>
            Forgot your password?
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
