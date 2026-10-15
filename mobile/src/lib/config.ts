import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { parseMapFlag } from './map-config';
const host = Constants.expoConfig?.hostUri?.split(':')[0];
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  `http://${host || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost')}:3001`
).replace(/\/$/, '');
export const GOOGLE_MAPS = parseMapFlag(process.env.EXPO_PUBLIC_GOOGLE_MAPS);
export const OSRM_URL =
  process.env.EXPO_PUBLIC_OSRM_URL || 'https://router.project-osrm.org';
export const GEOCODING_URL =
  process.env.EXPO_PUBLIC_GEOCODING_URL ||
  'https://nominatim.openstreetmap.org';
