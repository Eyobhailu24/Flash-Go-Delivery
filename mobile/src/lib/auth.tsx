import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  api,
  getSession,
  jsonBody,
  setSession,
  settledSession,
  subscribeSession,
  type Session,
} from './auth-api';
import { queryClient } from './query';
import type { AuthUser, UserRole } from '@/types/auth';

export const roleHome = (role?: UserRole | null) =>
  role === 'driver'
    ? '/driver'
    : role === 'business'
      ? '/business'
      : role === 'admin'
        ? '/admin'
        : '/customer';
type Auth = {
  user: AuthUser | null;
  ready: boolean;
  login: (phone: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready && user?.role !== 'driver')
      void import('./driver-location')
        .then(({ stopDriverTracking }) => stopDriverTracking())
        .catch(() => {});
  }, [ready, user?.role]);
  useEffect(() => {
    const unsubscribe = subscribeSession((value) => {
      setUser(value?.user ?? null);
      if (!value) queryClient.clear();
    });
    void getSession()
      .then(async (saved) => {
        setUser(saved?.user ?? null);
        setReady(true);
        if (saved) {
          try {
            const data = await api<{ user: AuthUser }>('/auth/me');
            const current = await getSession();
            if (current?.user.id === data.user.id)
              await setSession({ ...current, user: data.user });
          } catch {
            /* Cached session remains usable offline; protected requests still enforce server access. */
          }
        }
      })
      .catch(() => setReady(true));
    return unsubscribe;
  }, []);
  async function login(phone: string, password: string) {
    const result = await api<Session>(
      '/auth/mobile/login',
      jsonBody({ phoneNumber: phone, password }),
    );
    queryClient.clear();
    await setSession(result);
    return result.user;
  }
  async function logout() {
    const { stopDriverTracking } = await import('./driver-location');
    const { unregisterPush } = await import('./notifications');
    await stopDriverTracking().catch(() => {});
    await unregisterPush().catch(() => {});
    const current = await settledSession();
    try {
      if (current)
        await api(
          '/auth/mobile/logout',
          jsonBody({ refreshToken: current.refreshToken }),
        );
    } finally {
      await setSession(null);
      queryClient.clear();
    }
  }
  async function refresh() {
    const result = await api<{ user: AuthUser }>('/auth/me');
    const current = await getSession();
    if (current?.user.id === result.user.id)
      await setSession({ ...current, user: result.user });
  }
  return (
    <Context.Provider value={{ user, ready, login, logout, refresh }}>
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}
