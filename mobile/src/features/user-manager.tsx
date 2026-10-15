import { useLanguage } from '@/lib/i18n';
import { useState } from 'react';
import { View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Page } from '@/components/page';
import {
  Button,
  Card,
  Checkbox,
  Choice,
  Empty,
  ErrorState,
  Input,
  LoadingCards,
  Photo,
  Pill,
  Row,
  Sheet,
  Txt,
  useAction,
} from '@/components/ui';
import {
  LocationPicker,
  type AddressPoint,
} from '@/components/location-picker';
import { api, AuthApiError, jsonBody } from '@/lib/auth-api';
import { queryClient } from '@/lib/query';
import { useDebounced } from '@/lib/location';
import { chooseImage, formWithImage, type UploadImage } from '@/lib/upload';
import { businessProfileImageUrl } from '@/lib/admin-business-api';
import type { User } from '@/api/users';
import { normalizeEthiopiaPhone } from '@/lib/ethiopia-phone';
type Profile = Record<string, string | number | boolean | null>;
export function UserManager({
  roleFilter,
}: {
  roleFilter?: 'business' | 'driver';
}) {
  const { t } = useLanguage();
  const action = useAction();
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  const [removing, setRemoving] = useState<User | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [location, setLocation] = useState<AddressPoint | null>(null);
  const [image, setImage] = useState<UploadImage | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const query = useInfiniteQuery({
    queryKey: ['users', roleFilter, q],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api<{ users: User[] }>(
        `/users?${new URLSearchParams({ limit: '30', offset: String(pageParam), q, ...(roleFilter ? { role: roleFilter } : {}) })}`,
      ),
    getNextPageParam: (page, pages) =>
      page.users.length === 30 ? pages.length * 30 : undefined,
  });
  const change = (key: string, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  async function edit(row: User | null) {
    let details: Profile | null = null;
    if (roleFilter && row) {
      try {
        details = (
          await api<{ profile: Profile }>(
            `/profiles/${roleFilter === 'business' ? 'businesses' : 'drivers'}/${row.id}`,
          )
        ).profile;
      } catch (error) {
        if (!(error instanceof AuthApiError && error.status === 404))
          throw error;
      }
    }
    setProfile(details);
    setEditing(row);
    setCreatedId(null);
    setImage(null);
    setLocation(
      details?.latitude != null && details?.longitude != null
        ? {
            latitude: Number(details.latitude),
            longitude: Number(details.longitude),
            address: String(details.address || ''),
          }
        : null,
    );
    setForm({
      fullName: row?.fullName || '',
      email: row?.email || '',
      phoneNumber: row?.phoneNumber || '',
      password: '',
      role: roleFilter || row?.role || 'customer',
      status: row?.status || 'active',
      isVerified: String(row?.isVerified ?? false),
      businessName: String(details?.businessName || ''),
      businessType: String(details?.businessType || ''),
      businessStatus: String(details?.status || 'pending'),
      vehicleType: String(details?.vehicleType || ''),
      licenseNumber: String(details?.licenseNumber || ''),
      rating: String(details?.rating || 0),
      isAvailable: String(details?.isAvailable ?? false),
    });
  }
  async function save() {
    if (form.fullName.trim().length < 2 || !form.email.includes('@'))
      throw new Error('Enter a full name and valid email.');
    if (roleFilter === 'business' && (!form.businessName.trim() || !location))
      throw new Error('Business name and location are required.');
    let id = editing?.id || createdId;
    const phoneNumber = normalizeEthiopiaPhone(form.phoneNumber);
    if (!phoneNumber)
      throw new Error('Enter an Ethiopian phone number, e.g. +251911223344.');
    const data = {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phoneNumber,
      role: form.role,
      status: form.status,
      ...(form.password ? { password: form.password } : {}),
    };
    if (!id) {
      if (form.password.length < 8)
        throw new Error('Password must have at least 8 characters.');
      const result = await api<{ user: User }>('/users', jsonBody(data));
      id = result.user.id;
      setCreatedId(id);
    } else await api(`/users/${id}`, jsonBody(data, 'PATCH'));
    await api(
      `/users/${id}`,
      jsonBody({ isVerified: form.isVerified === 'true' }, 'PATCH'),
    );
    if (roleFilter === 'business') {
      const body = {
        userId: id,
        businessName: form.businessName,
        businessType: form.businessType || undefined,
        address: location!.address,
        latitude: location!.latitude,
        longitude: location!.longitude,
        status: form.businessStatus,
      };
      await api(`/profiles/businesses${profile ? `/${id}` : ''}`, {
        method: profile ? 'PATCH' : 'POST',
        body: await formWithImage(body, image),
      });
    } else if (roleFilter === 'driver') {
      await api(
        `/profiles/drivers${profile ? `/${id}` : ''}`,
        jsonBody(
          {
            userId: id,
            vehicleType: form.vehicleType || undefined,
            licenseNumber: form.licenseNumber || undefined,
            rating: Number(form.rating),
            isAvailable: form.isAvailable === 'true',
          },
          profile ? 'PATCH' : 'POST',
        ),
      );
    }
    setEditing(undefined);
    await queryClient.invalidateQueries({ queryKey: ['users'] });
    await queryClient.invalidateQueries({ queryKey: ['businesses'] });
  }
  const field = (key: string, label: string, secure = false) => (
    <Input
      key={key}
      label={label}
      value={form[key] || ''}
      onChangeText={(value) => change(key, value)}
      secureTextEntry={secure}
      autoCapitalize={key === 'email' ? 'none' : undefined}
      keyboardType={
        key === 'phoneNumber'
          ? 'phone-pad'
          : ['rating'].includes(key)
            ? 'decimal-pad'
            : 'default'
      }
    />
  );
  return (
    <Page
      title={
        roleFilter === 'business'
          ? 'Businesses'
          : roleFilter === 'driver'
            ? 'Drivers'
            : 'Users'
      }
      back
      scroll={false}
    >
      <Row>
        <View style={{ flex: 1 }}>
          <Input placeholder="Search" value={search} onChangeText={setSearch} />
        </View>
        <Button onPress={() => void action.run(() => edit(null))}>Add</Button>
      </Row>
      {query.isPending ? (
        <LoadingCards />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <FlashList
          data={query.data?.pages.flatMap((page) => page.users) || []}
          keyExtractor={(row) => row.id}
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 15 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt bold size={19} style={{ flex: 1 }}>
                  {item.fullName}
                </Txt>
                <Pill>{item.status}</Pill>
              </Row>
              <Txt muted>{item.email}</Txt>
              <Txt muted>{item.phoneNumber || ''}</Txt>
              <Row>
                <Pill>{item.role}</Pill>
                <View style={{ flex: 1 }} />
                <Button
                  variant="secondary"
                  onPress={() => void action.run(() => edit(item))}
                >
                  Edit
                </Button>
                <Button variant="danger" onPress={() => setRemoving(item)}>
                  Delete
                </Button>
              </Row>
            </Card>
          )}
          ListEmptyComponent={<Empty />}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage)
              void query.fetchNextPage();
          }}
          onRefresh={() => void query.refetch()}
          refreshing={query.isRefetching}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <LoadingCards count={1} />
            ) : (
              <View style={{ height: 20 }} />
            )
          }
        />
      )}
      <Sheet
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={
          editing
            ? 'Edit'
            : roleFilter === 'business'
              ? 'Add Business'
              : roleFilter === 'driver'
                ? 'Add Driver'
                : 'Add'
        }
      >
        {field('fullName', 'Full name')}
        {field('email', 'Email address')}
        {field('phoneNumber', 'Phone number')}
        {field(
          'password',
          editing || createdId ? 'New password' : 'Password',
          true,
        )}
        {!roleFilter && (
          <Choice
            label="Role"
            value={form.role || 'customer'}
            onChange={(value) => change('role', value)}
            options={['customer', 'driver', 'business', 'admin'].map(
              (value) => ({ label: value, value }),
            )}
          />
        )}
        <Choice
          label="Status"
          value={form.status || 'active'}
          onChange={(value) => change('status', value)}
          options={['active', 'inactive', 'suspended'].map((value) => ({
            label: value,
            value,
          }))}
        />
        <Checkbox
          label="Phone verified"
          checked={form.isVerified === 'true'}
          onCheckedChange={(value) => change('isVerified', String(value))}
        />
        {roleFilter === 'business' && (
          <>
            {field('businessName', 'Business name')}
            {field('businessType', 'Business type')}
            <LocationPicker
              value={location}
              label="Address"
              onChange={setLocation}
            />
            <Photo
              uri={
                image?.uri ||
                businessProfileImageUrl(
                  String(profile?.imagePath || '') || null,
                )
              }
            />
            <Button
              variant="secondary"
              onPress={() =>
                void action.run(async () => {
                  const selected = await chooseImage();
                  if (selected) setImage(selected);
                })
              }
            >
              Choose image
            </Button>
            <Choice
              label="Status"
              value={form.businessStatus || 'pending'}
              onChange={(value) => change('businessStatus', value)}
              options={['pending', 'approved', 'rejected'].map((value) => ({
                label: value,
                value,
              }))}
            />
          </>
        )}
        {roleFilter === 'driver' && (
          <>
            {field('vehicleType', 'Vehicle type')}
            {field('licenseNumber', 'License number')}
            {field('rating', 'Rating')}
            <Choice
              label="Available"
              value={form.isAvailable || 'false'}
              onChange={(value) => change('isAvailable', value)}
              options={[
                { label: 'Available', value: 'true' },
                { label: 'Unavailable', value: 'false' },
              ]}
            />
          </>
        )}
        <Button
          loading={action.busy}
          onPress={() => void action.run(save, 'Saved')}
        >
          Save
        </Button>
      </Sheet>
      <Sheet open={!!removing} onClose={() => setRemoving(null)} title="Delete">
        <Txt>
          {t('Delete {name} and their associated profile?', {
            name: removing?.fullName || '',
          })}
        </Txt>
        <Button
          variant="danger"
          loading={action.busy}
          onPress={() =>
            void action.run(async () => {
              await api(`/users/${removing!.id}`, { method: 'DELETE' });
              setRemoving(null);
              await queryClient.invalidateQueries({ queryKey: ['users'] });
            })
          }
        >
          Confirm
        </Button>
      </Sheet>
    </Page>
  );
}
