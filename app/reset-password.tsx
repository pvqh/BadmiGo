import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text } from 'react-native';
import { requestPasswordReset } from '../src/data/auth';
import { Button } from '../src/ui/components/button';
import { Field } from '../src/ui/components/field';
import { colour, font, layout } from '../src/ui/theme';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const sending = useMutation({ mutationFn: () => requestPasswordReset(email) });

  if (sending.isSuccess) {
    return (
      <ScrollView contentContainerStyle={layout.page}>
        <Text style={font.heading}>Check your email</Text>
        <Text style={font.dim}>
          A reset link is on its way to {email.trim()}. Open it on this phone and you will
          be asked for a new password.
        </Text>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={layout.screen}>
      <ScrollView contentContainerStyle={layout.page}>
        <Text style={font.dim}>
          Only accounts made with an email address can be reset here. A username-only
          account has no address to send to, so ask an admin instead.
        </Text>

        <Field
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="nam@example.com"
          value={email}
        />

        {sending.isError ? (
          <Text style={[font.dim, { color: colour.down }]}>{sending.error.message}</Text>
        ) : null}

        <Button
          busy={sending.isPending}
          disabled={!email.includes('@')}
          label="Send a reset link"
          onPress={() => sending.mutate()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
