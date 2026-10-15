import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Sheet, Txt, useAction } from './ui';
import { DeliveryMap } from './maps/map';
import type { Point } from './maps/types';
import { currentLocation, reverseGeocode, searchPlaces } from '@/lib/location';
export type AddressPoint = Point & {
  address: string;
  label?: string;
  isDefault?: boolean;
};
export function LocationPicker({
  value,
  onChange,
  label = 'Delivery address',
}: {
  value?: AddressPoint | null;
  onChange: (value: AddressPoint) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState<Point | null>(value || null);
  const [address, setAddress] = useState(value?.address || '');
  const [search, setSearch] = useState('');
  const [places, setPlaces] = useState<
    Awaited<ReturnType<typeof searchPlaces>>
  >([]);
  const action = useAction();
  const selection = useRef(0);
  useEffect(
    () => () => {
      selection.current++;
    },
    [],
  );
  const close = () => {
    selection.current++;
    setOpen(false);
  };
  const pick = (next: Point) => {
    const revision = ++selection.current;
    setPoint(next);
    // Coordinates are a usable fallback; an older request must never replace
    // a newer selection or an address the user has typed manually.
    setAddress(`${next.latitude.toFixed(5)}, ${next.longitude.toFixed(5)}`);
    void reverseGeocode(next)
      .then((resolved) => {
        if (selection.current === revision) setAddress(resolved);
      })
      .catch(() => {
        /* Keep the coordinates when geocoding is unavailable. */
      });
  };
  return (
    <View style={{ gap: 9 }}>
      <Txt bold size={13}>
        {label}
      </Txt>
      {value && <Txt muted>{value.address}</Txt>}
      <Button
        variant="secondary"
        onPress={() => {
          selection.current++;
          setPoint(value || null);
          setAddress(value?.address || '');
          setPlaces([]);
          setOpen(true);
        }}
      >
        Choose location
      </Button>
      <Sheet open={open} onClose={close} title={label}>
        <Input placeholder="Search" value={search} onChangeText={setSearch} />
        <Button
          variant="secondary"
          loading={action.busy}
          onPress={() =>
            void action.run(async () => {
              if (search.trim().length < 3)
                throw new Error('Enter at least 3 characters.');
              const revision = selection.current;
              const results = await searchPlaces(search.trim());
              if (selection.current === revision) setPlaces(results);
            })
          }
        >
          Search
        </Button>
        {places.map((place) => (
          <Button
            key={place.place_id}
            variant="ghost"
            onPress={() => {
              selection.current++;
              setPoint({
                latitude: Number(place.lat),
                longitude: Number(place.lon),
              });
              setAddress(place.display_name);
              setPlaces([]);
            }}
          >
            {place.display_name}
          </Button>
        ))}
        <DeliveryMap
          height={300}
          markers={point ? [point] : []}
          onPick={pick}
        />
        <Button
          variant="secondary"
          loading={action.busy}
          onPress={() =>
            void action.run(async () => {
              const revision = ++selection.current;
              const next = await currentLocation();
              if (selection.current === revision) pick(next);
            })
          }
        >
          Use my location
        </Button>
        <Input
          label="Address"
          value={address}
          onChangeText={(text) => {
            selection.current++;
            setAddress(text);
          }}
        />
        <Button
          disabled={!point || !address.trim()}
          loading={action.busy}
          onPress={() => {
            if (point && address.trim()) {
              onChange({ ...point, address: address.trim() });
              close();
            }
          }}
        >
          Confirm location
        </Button>
      </Sheet>
    </View>
  );
}
