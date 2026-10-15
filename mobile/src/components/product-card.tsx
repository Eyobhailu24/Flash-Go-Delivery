import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Card, Txt, Photo, Pill, Row, Button, colors } from './ui';
import type { CategoryItem } from '@/lib/admin-catalog-api';
import { catalogItemImageUrl } from '@/lib/admin-catalog-api';
import { formatBirr, discountedPrice } from '@/lib/currency';
import { useLanguage } from '@/lib/i18n';
export const ProductCard = memo(function ProductCard({
  item,
  onAdd,
  busy = false,
  width,
}: {
  item: CategoryItem;
  onAdd: (item: CategoryItem) => void;
  busy?: boolean;
  width?: number;
}) {
  const { t } = useLanguage();
  return (
    <Card style={{ width, padding: 0, overflow: 'hidden', gap: 0 }}>
      <View>
        <Photo
          uri={catalogItemImageUrl(item.imagePath)}
          style={{ height: 150, borderRadius: 0 }}
        />
        {Number(item.discount) > 0 && (
          <View style={{ position: 'absolute', top: 10, left: 10 }}>
            <Pill>
              {t('{amount} off', { amount: formatBirr(item.discount) })}
            </Pill>
          </View>
        )}
      </View>
      <View style={{ padding: 16, gap: 8 }}>
        <Txt bold size={18} numberOfLines={1}>
          {item.name}
        </Txt>
        <Txt muted size={12} numberOfLines={1}>
          {item.businessName || item.categoryName || ''}
        </Txt>
        {item.description && (
          <Txt muted size={12} numberOfLines={2}>
            {item.description}
          </Txt>
        )}
        <Row style={{ justifyContent: 'space-between', marginTop: 3 }}>
          <View>
            <Txt bold size={17} style={{ color: colors.orange }}>
              {formatBirr(discountedPrice(item.price, item.discount))}
            </Txt>
            {Number(item.discount) > 0 && (
              <Txt
                muted
                size={11}
                style={{ textDecorationLine: 'line-through' }}
              >
                {formatBirr(item.price)}
              </Txt>
            )}
          </View>
          <Button
            accessibilityLabel="Add to cart"
            disabled={!item.isAvailable}
            loading={busy}
            onPress={() => onAdd(item)}
            className="min-h-10 px-3 py-2"
            icon={<Plus size={18} color="white" />}
          >
            {item.isAvailable ? '' : 'Unavailable'}
          </Button>
        </Row>
      </View>
    </Card>
  );
});
