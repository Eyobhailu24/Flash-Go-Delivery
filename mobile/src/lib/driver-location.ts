import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSession } from './auth-api';
import { postDriverLocation } from './driver-dispatch-api';

export const DRIVER_TASK = 'flashgo-driver-location';
const TRACKING_KEY = 'flashgo.driver-tracking';
let lastSentAt = 0;
let uploading = false;
async function sendLocation(location: Location.LocationObject) {
  if (
    uploading ||
    Date.now() - lastSentAt < 12_000 ||
    Date.now() - location.timestamp > 120_000
  )
    return;
  const session = await getSession();
  if (session?.user.role !== 'driver') {
    await stopDriverTracking();
    return;
  }
  uploading = true;
  try {
    await postDriverLocation({
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      heading: location.coords.heading ?? undefined,
      speed: location.coords.speed ?? undefined,
    });
    lastSentAt = Date.now();
    await AsyncStorage.setItem(
      'flashgo.last-location-sent',
      String(lastSentAt),
    );
  } finally {
    uploading = false;
  }
}
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(DRIVER_TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    DRIVER_TASK,
    async ({ data, error }) => {
      if (
        error ||
        !data?.locations?.length ||
        (await AsyncStorage.getItem(TRACKING_KEY)) !== 'true'
      )
        return;
      await sendLocation(data.locations[data.locations.length - 1]).catch(
        () => {},
      );
    },
  );
}
export async function startDriverTracking() {
  if (Platform.OS === 'web')
    throw new Error(
      'Background tracking requires an Android or iOS development build.',
    );
  if ((await getSession())?.user.role !== 'driver')
    throw new Error('Sign in as a driver to share location.');
  const foregroundPermission =
    await Location.requestForegroundPermissionsAsync();
  if (foregroundPermission.status !== 'granted')
    throw new Error('Location permission is required for dispatch.');
  const backgroundPermission =
    await Location.requestBackgroundPermissionsAsync();
  if (backgroundPermission.status !== 'granted')
    throw new Error(
      'Allow background location in Settings to continue tracking while using another app.',
    );
  if (!(await TaskManager.isAvailableAsync()))
    throw new Error('Background tracking needs a development build.');
  await Location.startLocationUpdatesAsync(DRIVER_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 25,
    timeInterval: 15000,
    deferredUpdatesInterval: 15000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'FlashGo driver tracking',
      notificationBody:
        'Location sharing is active. Open FlashGo to stop tracking.',
      notificationColor: '#f97316',
      killServiceOnDestroy: true,
    },
  });
  await AsyncStorage.setItem(TRACKING_KEY, 'true');
  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  await sendLocation(current).catch(() => {});
}
export async function stopDriverTracking() {
  await AsyncStorage.setItem(TRACKING_KEY, 'false');
  if (
    Platform.OS !== 'web' &&
    (await Location.hasStartedLocationUpdatesAsync(DRIVER_TASK).catch(
      () => false,
    ))
  )
    await Location.stopLocationUpdatesAsync(DRIVER_TASK);
}
export async function isDriverTracking() {
  return (
    Platform.OS !== 'web' &&
    (await AsyncStorage.getItem(TRACKING_KEY)) === 'true' &&
    (await Location.hasStartedLocationUpdatesAsync(DRIVER_TASK).catch(
      () => false,
    ))
  );
}
