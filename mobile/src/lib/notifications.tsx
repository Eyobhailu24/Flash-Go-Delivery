import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { api, jsonBody } from './auth-api';
import { useAuth } from './auth';
import { queryClient } from './query';

if (Platform.OS !== 'web')
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
export async function registerPush(requestPermission = true) {
  if (Platform.OS === 'web' || !Device.isDevice)
    throw new Error(
      'Remote push notifications require a physical Android or iOS device.',
    );
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Order updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 200, 250],
      lightColor: '#f97316',
    });
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted' && requestPermission)
    permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted')
    throw new Error('Allow notifications in Settings to receive order alerts.');
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID || Constants.easConfig?.projectId;
  if (!projectId)
    throw new Error(
      'Push is not configured in this build yet. In-app notifications remain available.',
    );
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api('/mobile/devices', jsonBody({ token, platform: Platform.OS }));
  await AsyncStorage.setItem('flashgo.push-token', token);
  return token;
}
export async function unregisterPush() {
  const token = await AsyncStorage.getItem('flashgo.push-token');
  if (token) await api('/mobile/devices', jsonBody({ token }, 'DELETE'));
  await AsyncStorage.removeItem('flashgo.push-token');
}
export function NotificationObserver() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user || Platform.OS === 'web') return;
    void registerPush(false).catch(() => {});
    const received = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries();
    });
    const navigate = () => {
      void queryClient.invalidateQueries();
      router.push('/notifications');
    };
    const response =
      Notifications.addNotificationResponseReceivedListener(navigate);
    void Notifications.getLastNotificationResponseAsync().then((value) => {
      if (value) {
        navigate();
        void Notifications.clearLastNotificationResponseAsync();
      }
    });
    return () => {
      received.remove();
      response.remove();
    };
  }, [user?.id]);
  return null;
}
