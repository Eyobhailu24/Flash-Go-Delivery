import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Page, go } from '@/components/page';
import {
  Button,
  Card,
  Choice,
  ErrorState,
  Input,
  LoadingCards,
  Row,
  Txt,
  useAction,
} from '@/components/ui';
import { LocationPicker } from '@/components/location-picker';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { api, jsonBody } from '@/lib/auth-api';
import { normalizeEthiopiaPhone } from '@/lib/ethiopia-phone';
import {
  fetchMyCustomerProfile,
  patchMyCustomerProfile,
} from '@/lib/customer-profile-api';
export default function ProfileScreen() {
  const { user, ready, refresh } = useAuth();
  const action = useAction();
  const { language, setLanguage } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  useEffect(() => {
    setName(user?.fullName || '');
    setEmail(user?.email || '');
    setPhone(user?.phoneNumber || '');
  }, [user?.id]);
  const profile = useQuery({
    queryKey: ['customer-profile', user?.id],
    queryFn: fetchMyCustomerProfile,
    enabled: user?.role === 'customer',
  });
  if (ready && !user) return <Redirect href="/auth/login" />;
  return (
    <Page title="Profile" back>
      <Card>
        <Txt bold size={21}>
          Account credentials
        </Txt>
        <Input label="Full name" value={name} onChangeText={setName} />
        <Input
          label="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <Button
          loading={action.busy}
          onPress={() =>
            void action.run(async () => {
              const phoneNumber = normalizeEthiopiaPhone(phone);
              if (!phoneNumber)
                throw new Error(
                  'Enter an Ethiopian phone number, e.g. +251911223344.',
                );
              await api(
                '/auth/me',
                jsonBody({ fullName: name, email, phoneNumber }, 'PATCH'),
              );
              await refresh();
            }, 'Saved')
          }
        >
          Save
        </Button>
      </Card>
      <Card>
        <Choice
          label="Language"
          value={language}
          options={[
            { label: 'English', value: 'en' },
            { label: 'አማርኛ', value: 'am' },
          ]}
          onChange={(value) => setLanguage(value as 'en' | 'am')}
        />
        <Button variant="secondary" onPress={() => go('/auth/password')}>
          Change password
        </Button>
      </Card>
      {user?.role === 'customer' && (
        <Card>
          <Txt bold size={21}>
            Saved addresses
          </Txt>
          {profile.isPending ? (
            <LoadingCards count={1} />
          ) : profile.error ? (
            <ErrorState
              error={profile.error}
              retry={() => void profile.refetch()}
            />
          ) : null}
          {profile.data?.addresses?.map((address, index) => (
            <Row key={index}>
              <Txt style={{ flex: 1 }}>{address.address}</Txt>
              <Button
                variant="danger"
                onPress={() =>
                  void action.run(async () => {
                    await patchMyCustomerProfile({
                      addresses: profile.data?.addresses?.filter(
                        (_, i) => i !== index,
                      ),
                    });
                    await profile.refetch();
                  })
                }
              >
                Remove
              </Button>
            </Row>
          ))}
          <LocationPicker
            label="Add address"
            onChange={(value) =>
              void action.run(async () => {
                await patchMyCustomerProfile({
                  addresses: [
                    ...(profile.data?.addresses || []),
                    {
                      address: value.address,
                      lat: value.latitude,
                      lng: value.longitude,
                      isDefault: !profile.data?.addresses?.length,
                    },
                  ],
                });
                await profile.refetch();
              })
            }
          />
        </Card>
      )}
    </Page>
  );
}
