import { QueryClient } from '@tanstack/react-query';
import { AuthApiError } from './auth-api';
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      retry: (count, error) =>
        !(error instanceof AuthApiError && error.status < 500) && count < 2,
    },
    mutations: { retry: false },
  },
});
