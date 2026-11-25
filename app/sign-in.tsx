import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { signIn } from '../src/data/auth';
import { Button } from '../src/ui/components/button';
import { Field } from '../src/ui/components/field';
import { InstallHint } from '../src/ui/components/install-hint';
import { colour, font, layout, space } from '../src/ui/theme';
import { pickUsernameExample } from '../src/ui/username-examples';

export default function SignIn() {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [example] = useState(pickUsernameExample);

  const signingIn = useMutation({ mutationFn: () => signIn(handle, password) });
  const ready = handle.trim().length > 0 && password.length > 0;

  return (
    <KeyboardAvoidingView behavior="padding" style={layout.screen}>
      <ScrollView contentContainerStyle={[layout.page, { paddingTop: space.block * 3 }]}>
        <View style={{ gap: space.tight }}>
          <Text accessibilityRole="header" style={[font.title, { fontSize: 36 }]}>
            Đội Vịt Leaderboard
          </Text>
          <Text style={font.dim}>Nào mình cùng leo rank !!!</Text>
        </View>

        <InstallHint />

        <View style={{ height: space.row }} />

        <Field
  
          autoCapitalize="none"
          autoComplete="username"
          autoCorrect={false}
          label="Tên đăng nhập"
          onChangeText={setHandle}
          placeholder={example}
          value={handle}
        />
        <Field
          autoCapitalize="none"
          autoComplete="current-password"
          label="Mật khẩu"
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          value={password}
        />

        {signingIn.isError ? (
          <Text style={[font.dim, { color: colour.down }]}>{signingIn.error.message}</Text>
        ) : null}

        <Button
          busy={signingIn.isPending}
          disabled={!ready}
          label="Đăng nhập"
          onPress={() => signingIn.mutate()}
        />
        <Text style={[font.body, { textAlign: 'center' }]}>
          {'Chưa có tài khoản? '}
          <Link href="/sign-up" style={{ color: colour.courtInk, fontWeight: '700' }}>
            Tham gia ngay
          </Link>
        </Text>
        <Text style={[font.dim, { textAlign: 'center', paddingTop: space.row }]}>
          {'Quên mật khẩu?\nHãy báo admin để được cấp mật khẩu tạm.'}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
