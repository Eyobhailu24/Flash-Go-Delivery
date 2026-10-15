import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap } from 'lucide-react-native';
import { Page, go } from '@/components/page';
import { Button, Card, Input, Row, Txt, useAction } from '@/components/ui';
import { useAuth, roleHome } from '@/lib/auth';
import { api, AuthApiError, jsonBody } from '@/lib/auth-api';
import { normalizeEthiopiaPhone } from '@/lib/ethiopia-phone';

const titles: Record<string, string> = {
  login: 'Welcome back',
  signup: 'Create account',
  verify: 'Verify phone',
  forgot: 'Reset password',
  reset: 'Reset password',
  password: 'Change password',
};
export default function AuthScreen() {
  const params = useLocalSearchParams<{ mode: string; phone?: string }>();
  const mode = params.mode || 'login';
  const { login } = useAuth();
  const action = useAction();
  const [form, setForm] = useState<Record<string, string>>({
    phone: params.phone || '',
  });
  const change = (key: string, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  const field = (key: string, label: string, password = false) => (
    <Input
      key={key}
      label={label}
      value={form[key] || ''}
      onChangeText={(value) => change(key, value)}
      secureTextEntry={password}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType={
        key === 'phone'
          ? 'phone-pad'
          : key === 'email'
            ? 'email-address'
            : key === 'otp'
              ? 'number-pad'
              : 'default'
      }
      textContentType={
        key === 'otp'
          ? 'oneTimeCode'
          : key === 'phone'
            ? 'telephoneNumber'
            : undefined
      }
      maxLength={key === 'otp' ? 8 : undefined}
    />
  );
  const phone = () => {
    const normalized = normalizeEthiopiaPhone(form.phone || '');
    if (!normalized)
      throw new Error('Enter an Ethiopian phone number, e.g. +251911223344.');
    return normalized;
  };
  async function submit() {
    if (
      ['signup', 'reset', 'password'].includes(mode) &&
      ((form.password || '').length < 8 || form.password !== form.confirm)
    )
      throw new Error('Use at least 8 characters and matching passwords.');
    if (mode === 'login') {
      try {
        const user = await login(phone(), form.password || '');
        router.replace(roleHome(user.role) as never);
      } catch (error) {
        if (error instanceof AuthApiError && error.data?.requiresVerification) {
          go(`/auth/verify?phone=${encodeURIComponent(phone())}`);
          return;
        }
        throw error;
      }
    } else if (mode === 'signup') {
      await api(
        '/auth/signup',
        jsonBody({
          phoneNumber: phone(),
          fullName: form.name,
          email: form.email,
          password: form.password,
        }),
      );
      go(`/auth/verify?phone=${encodeURIComponent(phone())}`);
    } else if (mode === 'verify') {
      await api(
        '/auth/verify-otp',
        jsonBody({ phoneNumber: phone(), otp: form.otp }),
      );
      router.replace({
        pathname: '/auth/[mode]',
        params: { mode: 'login', phone: phone() },
      });
    } else if (mode === 'forgot') {
      await api('/auth/forgot-password', jsonBody({ phoneNumber: phone() }));
      go(`/auth/reset?phone=${encodeURIComponent(phone())}`);
    } else if (mode === 'reset') {
      await api(
        '/auth/reset-password',
        jsonBody({
          phoneNumber: phone(),
          otp: form.otp,
          newPassword: form.password,
        }),
      );
      router.replace('/auth/login');
    } else if (mode === 'password') {
      await api(
        '/auth/change-password',
        jsonBody({ currentPassword: form.current, newPassword: form.password }),
      );
      router.back();
    }
  }
  return (
    <Page back>
      <LinearGradient
        colors={['#fff0db', '#ffedd5', '#fffaf5']}
        style={{ padding: 26, borderRadius: 28, gap: 15 }}
      >
        <Row>
          <View
            style={{
              padding: 12,
              backgroundColor: '#f97316',
              borderRadius: 16,
            }}
          >
            <Zap fill="white" color="white" size={26} />
          </View>
          <Txt bold size={24}>
            FlashGo Delivery
          </Txt>
        </Row>
        <Txt bold size={31}>
          {titles[mode] || 'Login'}
        </Txt>
        <Txt muted>Your favorites, delivered to your door.</Txt>
      </LinearGradient>
      <Card>
        {mode === 'signup' && (
          <>
            {field('name', 'Full name')}
            {field('email', 'Email address')}
          </>
        )}
        {mode !== 'password' && field('phone', 'Phone number')}
        {['verify', 'reset'].includes(mode) &&
          field('otp', 'Verification code')}
        {mode === 'password' && field('current', 'Current password', true)}
        {['login', 'signup', 'reset', 'password'].includes(mode) &&
          field(
            'password',
            mode === 'login' || mode === 'signup' ? 'Password' : 'New password',
            true,
          )}
        {['signup', 'reset', 'password'].includes(mode) &&
          field('confirm', 'Confirm password', true)}
        <Button loading={action.busy} onPress={() => void action.run(submit)}>
          {mode === 'login'
            ? 'Login'
            : mode === 'verify'
              ? 'Verify'
              : mode === 'forgot'
                ? 'Send code'
                : 'Save'}
        </Button>
        {action.error && (
          <Txt style={{ color: '#dc2626' }}>{action.error.message}</Txt>
        )}
        {mode === 'login' && (
          <>
            <Button variant="ghost" onPress={() => go('/auth/forgot')}>
              Forgot password?
            </Button>
            <Button variant="secondary" onPress={() => go('/auth/signup')}>
              Create account
            </Button>
          </>
        )}
        {mode === 'verify' && (
          <Button
            variant="ghost"
            loading={action.busy}
            onPress={() =>
              void action.run(
                () =>
                  api(
                    '/auth/resend-signup-otp',
                    jsonBody({ phoneNumber: phone() }),
                  ),
                'Code sent',
              )
            }
          >
            Resend code
          </Button>
        )}
      </Card>
      <Button variant="ghost" onPress={() => router.replace('/customer')}>
        Continue as guest
      </Button>
    </Page>
  );
}
