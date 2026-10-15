import { useLanguage } from '@/lib/i18n';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { Page, go } from '@/components/page';
import {
  Button,
  Card,
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
import { api, jsonBody } from '@/lib/auth-api';
import { useAuth } from '@/lib/auth';
import { queryClient } from '@/lib/query';
import {
  fetchCategoryNameCatalog,
  catalogItemImageUrl,
  type CategoryNameCatalog,
} from '@/lib/admin-catalog-api';
import { chooseImage, formWithImage, type UploadImage } from '@/lib/upload';
import { formatBirr } from '@/lib/currency';
import { useDebounced } from '@/lib/location';
type CatalogRow = {
  id: string;
  name?: string;
  description?: string | null;
  price?: string;
  discount?: string | null;
  sortOrder?: number;
  isAvailable?: boolean;
  isActive?: boolean;
  imagePath?: string | null;
  categoryNameId?: string;
  categoryName?: CategoryNameCatalog;
  businessId?: string;
};
type Kind = 'names' | 'categories' | 'items';
const paths = {
  names: '/catalog/category-name-catalog',
  categories: '/catalog/product-categories',
  items: '/catalog/category-items',
};
const titles = {
  names: 'Category name catalog',
  categories: 'Your categories',
  items: 'Menu items',
};
export function CatalogManager({
  kind,
  admin = false,
}: {
  kind: Kind;
  admin?: boolean;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    businessId?: string;
    id?: string;
    categoryId?: string;
  }>();
  const businessId = admin ? params.businessId : user?.id;
  const categoryId = params.categoryId || params.id;
  const action = useAction();
  const [search, setSearch] = useState('');
  const searchQuery = useDebounced(search);
  const [sort, setSort] = useState('name');
  const [editing, setEditing] = useState<CatalogRow | null | undefined>(
    undefined,
  );
  const [removing, setRemoving] = useState<CatalogRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [image, setImage] = useState<UploadImage | null>(null);
  const key = [
    'manage-catalog',
    kind,
    businessId,
    categoryId,
    searchQuery,
    sort,
  ];
  const names = useQuery({
    queryKey: ['catalog-names'],
    queryFn: () => fetchCategoryNameCatalog({ limit: 200 }),
    enabled: kind === 'categories',
  });
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const q = new URLSearchParams({
        limit: '40',
        offset: String(pageParam),
        q: searchQuery,
        sort,
        ...(businessId && kind !== 'names' ? { businessId } : {}),
        ...(categoryId && kind === 'items' ? { categoryId } : {}),
      });
      const data = await api<Record<string, CatalogRow[]>>(
        `${paths[kind]}?${q}`,
      );
      return data[
        kind === 'names'
          ? 'categoryNames'
          : kind === 'categories'
            ? 'categories'
            : 'items'
      ];
    },
    getNextPageParam: (page, pages) =>
      page.length === 40 ? pages.length * 40 : undefined,
  });
  const titleOf = (row: CatalogRow) =>
    row.name || row.categoryName?.name || 'Category';
  const rows = query.data?.pages.flat() || [];
  const change = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  function edit(row: CatalogRow | null) {
    setImage(null);
    setEditing(row);
    setForm({
      name: row?.name || '',
      description: row?.description || '',
      price: row?.price || '',
      discount: row?.discount || '0',
      categoryNameId: row?.categoryNameId || '',
      sortOrder: String(row?.sortOrder || 0),
      isAvailable: String(row?.isAvailable ?? true),
      isActive: String(row?.isActive ?? true),
    });
  }
  async function save() {
    const fields: Record<string, unknown> =
      kind === 'categories'
        ? {
            categoryNameId: form.categoryNameId,
            sortOrder: Number(form.sortOrder),
            ...(editing ? {} : { businessId }),
          }
        : kind === 'names'
          ? { name: form.name.trim(), isActive: form.isActive === 'true' }
          : {
              name: form.name.trim(),
              description: form.description,
              price: Number(form.price),
              discount: Number(form.discount),
              sortOrder: Number(form.sortOrder),
              isAvailable: form.isAvailable === 'true',
              ...(editing ? {} : { categoryId }),
            };
    if (kind !== 'categories' && !form.name.trim())
      throw new Error('Name is required.');
    if (
      kind === 'items' &&
      (!form.price ||
        !Number.isFinite(Number(form.price)) ||
        Number(form.price) < 0 ||
        !Number.isFinite(Number(form.discount)) ||
        Number(form.discount) < 0)
    )
      throw new Error('Enter valid non-negative prices.');
    if (kind === 'categories' && !form.categoryNameId)
      throw new Error('Choose a category name.');
    const path = `${paths[kind]}${editing ? `/${editing.id}` : ''}`;
    if (kind === 'categories')
      await api(path, jsonBody(fields, editing ? 'PATCH' : 'POST'));
    else
      await api(path, {
        method: editing ? 'PATCH' : 'POST',
        body: await formWithImage(fields, image),
      });
    setEditing(undefined);
    await queryClient.invalidateQueries({ queryKey: ['manage-catalog'] });
    await queryClient.invalidateQueries({ queryKey: ['catalog-names'] });
  }
  return (
    <Page title={titles[kind]} back scroll={false}>
      <Row>
        <View style={{ flex: 1 }}>
          <Input placeholder="Search" value={search} onChangeText={setSearch} />
        </View>
        <Button onPress={() => edit(null)}>Add</Button>
      </Row>
      <Choice
        label="Sort order"
        value={sort}
        onChange={setSort}
        options={[
          { label: 'Name', value: 'name' },
          { label: 'Sort order', value: 'sortOrder' },
          ...(kind === 'items' ? [{ label: 'Price', value: 'price' }] : []),
        ]}
      />
      {query.isPending ? (
        <LoadingCards />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(row) => row.id}
          renderItem={({ item: row }) => (
            <Card style={{ marginBottom: 15 }}>
              <Pressable
                disabled={kind !== 'categories'}
                onPress={() =>
                  go(
                    admin
                      ? `/admin/items?categoryId=${row.id}&businessId=${businessId}`
                      : `/business/categories/${row.id}`,
                  )
                }
              >
                <Row>
                  {kind !== 'categories' && (
                    <Photo
                      uri={catalogItemImageUrl(row.imagePath || null)}
                      size={70}
                    />
                  )}
                  <View style={{ flex: 1, gap: 5 }}>
                    <Txt bold size={18}>
                      {titleOf(row)}
                    </Txt>
                    {row.price && <Txt>{formatBirr(row.price)}</Txt>}
                    {row.description && (
                      <Txt muted numberOfLines={2}>
                        {row.description}
                      </Txt>
                    )}
                    <Pill>
                      {kind === 'items'
                        ? row.isAvailable
                          ? 'Available'
                          : 'Unavailable'
                        : kind === 'names'
                          ? row.isActive
                            ? 'active'
                            : 'inactive'
                          : 'Menu items'}
                    </Pill>
                  </View>
                </Row>
              </Pressable>
              <Row>
                <Button variant="secondary" onPress={() => edit(row)}>
                  Edit
                </Button>
                <Button variant="danger" onPress={() => setRemoving(row)}>
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
        title={editing ? 'Edit' : 'Add'}
      >
        {kind === 'categories' ? (
          <Choice
            label="Category"
            value={form.categoryNameId || ''}
            onChange={(value) => change('categoryNameId', value)}
            options={(names.data?.categoryNames || []).map((row) => ({
              value: row.id,
              label: row.name,
            }))}
          />
        ) : (
          <Input
            label="Name"
            value={form.name}
            onChangeText={(value) => change('name', value)}
          />
        )}
        {kind === 'items' && (
          <>
            <Input
              label="Description"
              value={form.description}
              multiline
              onChangeText={(value) => change('description', value)}
            />
            <Input
              label="Price"
              value={form.price}
              keyboardType="decimal-pad"
              onChangeText={(value) => change('price', value)}
            />
            <Input
              label="Discount"
              value={form.discount}
              keyboardType="decimal-pad"
              onChangeText={(value) => change('discount', value)}
            />
            <Choice
              label="Available"
              value={form.isAvailable || 'true'}
              onChange={(value) => change('isAvailable', value)}
              options={[
                { label: 'Available', value: 'true' },
                { label: 'Unavailable', value: 'false' },
              ]}
            />
          </>
        )}
        {kind !== 'names' && (
          <Input
            label="Sort order"
            keyboardType="number-pad"
            value={form.sortOrder}
            onChangeText={(value) => change('sortOrder', value)}
          />
        )}
        {kind === 'names' && (
          <Choice
            label="Status"
            value={form.isActive || 'true'}
            onChange={(value) => change('isActive', value)}
            options={[
              { label: 'active', value: 'true' },
              { label: 'inactive', value: 'false' },
            ]}
          />
        )}
        {kind !== 'categories' && (
          <>
            <Photo
              uri={
                image?.uri || catalogItemImageUrl(editing?.imagePath || null)
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
          {t('Delete {name}?', { name: removing ? titleOf(removing) : '' })}
        </Txt>
        <Button
          variant="danger"
          loading={action.busy}
          onPress={() =>
            void action.run(async () => {
              await api(`${paths[kind]}/${removing!.id}`, { method: 'DELETE' });
              setRemoving(null);
              await queryClient.invalidateQueries({
                queryKey: ['manage-catalog'],
              });
            })
          }
        >
          Confirm
        </Button>
      </Sheet>
    </Page>
  );
}
