import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text } from 'react-native';
import { signUp } from '../src/data/auth';
import { MIN_PASSWORD } from '../src/data/function-contract';
import { Button } from '../src/ui/components/button';
import { Field } from '../src/ui/components/field';
import { useUsernameCheck } from '../src/ui/queries';
import { colour, font, layout } from '../src/ui/theme';
import { pickUsernameExample } from '../src/ui/username-examples';

export default function SignUp() {
  const router = useRouter();
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [example] = useState(pickUsernameExample);

  const check = useUsernameCheck(handle);
  const signingUp = useMutation({ mutationFn: () => signUp(handle, password) });

  const handleReady = check.isSuccess && check.data === null;

  return (
    <KeyboardAvoidingView behavior="padding" style={layout.screen}>
      <ScrollView contentContainerStyle={layout.page} keyboardShouldPersistTaps="handled">
        <Field
          autoCapitalize="none"
          autoComplete="username"
          autoCorrect={false}
          hint="3 đến 20 ký tự: chữ hoa, chữ thường, số và _ . - đều được. Khi đăng nhập không cần gõ đúng chữ hoa."
          label="Tên đăng nhập"
          onChangeText={setHandle}
          placeholder={example}
          problem={check.isError ? check.error.message : (check.data ?? null)}
          value={handle}
        />

        <Field
          autoCapitalize="none"
          autoComplete="new-password"
          hint={`Ít nhất ${MIN_PASSWORD} ký tự. Nếu quên, admin sẽ cấp mật khẩu tạm.`}
          label="Mật khẩu"
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          value={password}
        />

        {signingUp.isError ? (
          <Text style={[font.dim, { color: colour.down }]}>{signingUp.error.message}</Text>
        ) : null}

        <Button
          busy={signingUp.isPending}
          disabled={!handleReady || password.length < MIN_PASSWORD}
          label={typeof check.data === 'string' ? 'Chọn tên đăng nhập khác' : 'Tạo tài khoản'}
          onPress={() => signingUp.mutate()}
        />
        <Text style={[font.body, { textAlign: 'center' }]}>
          {'Đã có tài khoản? '}
          <Text
            accessibilityRole="link"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}
            style={{ color: colour.courtInk, fontWeight: '700' }}
          >
            Đăng nhập
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
