import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  Menu,
  ShoppingCart,
  MapPin,
} from 'lucide-react-native';
import { useAuth, roleHome } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { Button, colors, IconButton, Row, Sheet, Txt, useAction } from './ui';

export const navigation = {
  customer: [
    ['Home', '/customer'],
    ['All Menu', '/customer/menu'],
    ['Deliver Packages', '/customer/packages'],
    ['Track Order', '/customer/orders'],
    ['Cart', '/customer/cart'],
    ['Profile', '/profile'],
    ['Notifications', '/notifications'],
  ],
  business: [
    ['Dashboard', '/business'],
    ['Categories', '/business/categories'],
    ['Orders', '/business/orders'],
    ['Notifications', '/notifications'],
    ['Account', '/business/account'],
    ['Profile', '/profile'],
  ],
  driver: [
    ['Current delivery', '/driver'],
    ['Profile', '/profile'],
    ['Notifications', '/notifications'],
  ],
  admin: [
    ['Overview', '/admin'],
    ['Users', '/admin/users'],
    ['Orders', '/admin/orders'],
    ['Add Business', '/admin/businesses'],
    ['Add Driver', '/admin/drivers'],
    ['Products', '/admin/products'],
    ['Product categories', '/admin/catalog'],
    ['Package orders', '/admin/packages'],
    ['Notifications', '/notifications'],
    ['Profile', '/profile'],
  ],
};
export const go = (path: string) => router.push(path as never);
export function Header({ back = false }: { back?: boolean }) {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const action = useAction();
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 15,
        gap: 10,
      }}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          {back && (
            <IconButton
              label="Back"
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace(roleHome(user?.role) as never)
              }
            >
              <ArrowLeft size={19} color={colors.ink} />
            </IconButton>
          )}
          <Pressable
            accessibilityLabel="FlashGo Home"
            onPress={() => router.replace(roleHome(user?.role) as never)}
          >
            <Image
              source={require('../../assets/logo.png')}
              style={{ width: 44, height: 44 }}
              contentFit="contain"
            />
          </Pressable>
        </Row>
        <Row style={{ gap: 5 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Language"
            onPress={() => setLanguage(language === 'en' ? 'am' : 'en')}
            style={{ padding: 10 }}
          >
            <Txt bold size={12}>
              {language === 'en' ? 'አማ' : 'EN'}
            </Txt>
          </Pressable>
          {(!user || user.role === 'customer') && (
            <IconButton label="Cart" onPress={() => go('/customer/cart')}>
              <ShoppingCart size={19} color={colors.orange} />
            </IconButton>
          )}
          <IconButton
            label="Notifications"
            onPress={() => go('/notifications')}
          >
            <Bell size={19} color={colors.orange} />
          </IconButton>
          <IconButton label="Menu" onPress={() => setOpen(true)}>
            <Menu size={20} color={colors.ink} />
          </IconButton>
        </Row>
      </Row>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={user?.fullName || 'Guest'}
      >
        {navigation[user?.role || 'customer'].map(([label, path]) => (
          <Button
            key={path}
            variant="ghost"
            onPress={() => {
              setOpen(false);
              go(path);
            }}
          >
            {label}
          </Button>
        ))}
        <Button
          loading={action.busy}
          variant="secondary"
          onPress={() => {
            if (!user) {
              setOpen(false);
              go('/auth/login');
            } else
              void action.run(async () => {
                await logout();
                setOpen(false);
                router.replace('/auth/login');
              });
          }}
        >
          {user ? 'Logout' : 'Login'}
        </Button>
      </Sheet>
    </View>
  );
}
export function Page({
  children,
  title,
  back,
  scroll = true,
  refresh,
  refreshing = false,
  header = true,
}: {
  children: ReactNode;
  title?: string;
  back?: boolean;
  scroll?: boolean;
  refresh?: () => void;
  refreshing?: boolean;
  header?: boolean;
}) {
  const content = (
    <>
      {title && (
        <Txt bold size={29} style={{ marginBottom: 5 }}>
          {title}
        </Txt>
      )}
      {children}
    </>
  );
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {header && <Header back={back} />}
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              refresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refresh}
                  tintColor={colors.orange}
                />
              ) : undefined
            }
            contentContainerStyle={{
              padding: 20,
              paddingTop: 8,
              paddingBottom: 35,
              gap: 23,
            }}
          >
            {content}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: 20, gap: 18 }}>
            {content}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
