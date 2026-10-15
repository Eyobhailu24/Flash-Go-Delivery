import '../global.css';
import '@/lib/driver-location';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  QueryClientProvider,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { useFonts } from 'expo-font';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { NotoSansEthiopic_400Regular } from '@expo-google-fonts/noto-sans-ethiopic/400Regular';
import { queryClient } from '@/lib/query';
import { AuthProvider } from '@/lib/auth';
import { LanguageProvider } from '@/lib/i18n';
import { NoticeProvider } from '@/components/ui';
import { NotificationObserver } from '@/lib/notifications';

void SplashScreen.preventAutoHideAsync();
export default function Layout() {
  const [fonts, fontError] = useFonts({
    Geist_400Regular,
    Geist_600SemiBold,
    NotoSansEthiopic_400Regular,
  });
  useEffect(() => {
    const appState = AppState.addEventListener('change', (state) =>
      focusManager.setFocused(state === 'active'),
    );
    const unsubscribe = NetInfo.addEventListener((state) =>
      onlineManager.setOnline(
        state.isConnected !== false && state.isInternetReachable !== false,
      ),
    );
    return () => {
      appState.remove();
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (fonts || fontError) void SplashScreen.hideAsync();
  }, [fonts, fontError]);
  if (!fonts && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <NoticeProvider>
              <AuthProvider>
                <NotificationObserver />
                <StatusBar style="dark" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: '#fffaf5' },
                  }}
                />
              </AuthProvider>
            </NoticeProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
