import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FlashGo Delivery',
  slug: 'flashgo-delivery',
  version: '1.0.0',
  scheme: 'flashgo',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: process.env.APP_IDENTIFIER || 'com.flashgo.delivery',
    supportsTablet: true,
    infoPlist: { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } },
  },
  android: {
    package: process.env.APP_IDENTIFIER || 'com.flashgo.delivery',
    ...(process.env.GOOGLE_SERVICES_JSON_PATH
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON_PATH }
      : {}),
    adaptiveIcon: {
      foregroundImage: './assets/icon.png',
      backgroundColor: '#fff7ed',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-status-bar',
    'expo-image',
    'expo-localization',
    'expo-web-browser',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#fff7ed',
        image: './assets/icon.png',
        imageWidth: 130,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'FlashGo uses your location to show nearby businesses and choose delivery addresses.',
        locationAlwaysAndWhenInUsePermission:
          'While driver tracking is enabled, FlashGo shares your location with dispatch and the customer, including in the background.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    ['expo-notifications', { color: '#f97316' }],
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose a business or menu photo to upload.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY || '',
      },
    ],
    ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
  ],
  extra: {
    ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID
      ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } }
      : {}),
  },
});
