import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Page } from '@/components/page';
import {
  Button,
  Card,
  ErrorState,
  Input,
  LoadingCards,
  Photo,
  Pill,
  useAction,
} from '@/components/ui';
import {
  LocationPicker,
  type AddressPoint,
} from '@/components/location-picker';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/auth-api';
import {
  fetchBusinessProfileById,
  businessProfileImageUrl,
} from '@/lib/admin-business-api';
import { chooseImage, formWithImage, type UploadImage } from '@/lib/upload';
export default function BusinessAccount() {
  const { user } = useAuth();
  const action = useAction();
  const query = useQuery({
    queryKey: ['business-profile', user?.id],
    queryFn: () => fetchBusinessProfileById(user!.id),
    enabled: !!user,
  });
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [location, setLocation] = useState<AddressPoint | null>(null);
  const [image, setImage] = useState<UploadImage | null>(null);
  useEffect(() => {
    const data = query.data;
    if (data) {
      setName(data.businessName);
      setType(data.businessType || '');
      if (data.latitude != null && data.longitude != null)
        setLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address || '',
        });
    }
  }, [query.data?.userId]);
  return (
    <Page title="Account" back>
      {query.isPending ? (
        <LoadingCards />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <Card>
          <Pill>{query.data?.status || 'pending'}</Pill>
          <Photo
            uri={
              image?.uri ||
              businessProfileImageUrl(query.data?.imagePath || null)
            }
            style={{ height: 210 }}
          />
          <Button
            variant="secondary"
            onPress={() =>
              void action.run(async () => {
                const value = await chooseImage();
                if (value) setImage(value);
              })
            }
          >
            Choose image
          </Button>
          <Input label="Business name" value={name} onChangeText={setName} />
          <Input label="Business type" value={type} onChangeText={setType} />
          <LocationPicker
            label="Address"
            value={location}
            onChange={setLocation}
          />
          <Button
            loading={action.busy}
            disabled={!name.trim()}
            onPress={() =>
              void action.run(async () => {
                await api(`/profiles/businesses/${user!.id}`, {
                  method: 'PATCH',
                  body: await formWithImage(
                    {
                      businessName: name,
                      businessType: type,
                      ...(location
                        ? {
                            address: location.address,
                            latitude: location.latitude,
                            longitude: location.longitude,
                          }
                        : {}),
                    },
                    image,
                  ),
                });
                await query.refetch();
              }, 'Saved')
            }
          >
            Save
          </Button>
        </Card>
      )}
    </Page>
  );
}
