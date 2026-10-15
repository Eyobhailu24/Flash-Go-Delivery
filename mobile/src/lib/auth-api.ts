import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_URL } from './config';
import type { AuthUser } from '@/types/auth';

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};
const KEY = 'flashgo.session.v1';
let session: Session | null | undefined;
let loading: Promise<Session | null> | undefined;
let renewing: Promise<Session | null> | undefined;
let revision = 0;
let persisting = Promise.resolve();
const listeners = new Set<(value: Session | null) => void>();
const storage = {
  get: () =>
    Platform.OS === 'web'
      ? AsyncStorage.getItem(KEY)
      : SecureStore.getItemAsync(KEY),
  set: (value: string) =>
    Platform.OS === 'web'
      ? AsyncStorage.setItem(KEY, value)
      : SecureStore.setItemAsync(KEY, value, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        }),
  remove: () =>
    Platform.OS === 'web'
      ? AsyncStorage.removeItem(KEY)
      : SecureStore.deleteItemAsync(KEY),
};
export function subscribeSession(listener: (value: Session | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export async function getSession(): Promise<Session | null> {
  if (session !== undefined) return session;
  if (!loading)
    loading = storage
      .get()
      .then((raw) => {
        if (session === undefined) {
          try {
            session = raw ? (JSON.parse(raw) as Session) : null;
          } catch {
            session = null;
          }
        }
        return session;
      })
      .finally(() => {
        loading = undefined;
      });
  return loading;
}
export async function setSession(value: Session | null) {
  revision += 1;
  session = value;
  listeners.forEach((listener) => listener(value));
  persisting = persisting
    .catch(() => {})
    .then(() =>
      value ? storage.set(JSON.stringify(value)) : storage.remove(),
    );
  await persisting;
}
export const settledSession = async () => {
  if (renewing) await renewing.catch(() => {});
  return getSession();
};
export class AuthApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}
export const getApiBaseUrl = () => API_URL;
export async function readAuthJson<T>(res: Response): Promise<T> {
  const data = await res
    .json()
    .catch(() => ({ message: 'The server returned an unreadable response.' }));
  if (!res.ok)
    throw new AuthApiError(data.message || 'Request failed.', res.status, data);
  return data as T;
}
async function timedFetch(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  const cancel = () => controller.abort();
  init.signal?.addEventListener('abort', cancel);
  if (init.signal?.aborted) controller.abort();
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', cancel);
  }
}
export async function renewSession(): Promise<Session | null> {
  if (!renewing)
    renewing = (async () => {
      const previous = await getSession();
      if (!previous) return null;
      const expectedRevision = revision;
      const response = await timedFetch('/auth/mobile/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: previous.refreshToken }),
      });
      if (revision !== expectedRevision) return getSession();
      if (response.status === 401 || response.status === 400) {
        await setSession(null);
        return null;
      }
      const tokens = await readAuthJson<{
        accessToken: string;
        refreshToken: string;
      }>(response);
      if (revision !== expectedRevision) return getSession();
      const next = { ...previous, ...tokens };
      await setSession(next);
      return next;
    })().finally(() => {
      renewing = undefined;
    });
  return renewing;
}
export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const current = await getSession();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (current) headers.set('Authorization', `Bearer ${current.accessToken}`);
  const response = await timedFetch(path, { ...init, headers });
  if (response.status !== 401 || !current || path.startsWith('/auth/mobile/'))
    return response;
  const latest = await getSession();
  // Never replay an in-flight request under a different account after a switch.
  if (!latest || latest.user.id !== current.user.id) return response;
  const next =
    latest?.accessToken !== current.accessToken ? latest : await renewSession();
  if (!next) return response;
  headers.set('Authorization', `Bearer ${next.accessToken}`);
  return timedFetch(path, { ...init, headers });
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  return readAuthJson<T>(await authFetch(path, init));
}
export const jsonBody = (data: unknown, method = 'POST'): RequestInit => ({
  method,
  body: JSON.stringify(data),
});
