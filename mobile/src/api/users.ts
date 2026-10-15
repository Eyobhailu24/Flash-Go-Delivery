'use client';

/** Reference implementation for admin feature hooks; general rules live in `frontend/AGENTS.md`. */

import { useCallback, useEffect, useState } from 'react';
import { authFetch, AuthApiError, readAuthJson } from '@/lib/auth-api';

export type User = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  role: string;
  status: string;
  isVerified: boolean;
  verifiedAt: string | null;
  createdAt: string;
};

export type UserRole = 'customer' | 'driver' | 'business' | 'admin';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export type CreateUserInput = {
  fullName: string;
  email: string;
  phoneNumber?: string;
  password: string;
  role: UserRole;
  status?: UserStatus;
};

export type UpdateUserInput = {
  fullName?: string;
  email?: string;
  /** Omit to leave unchanged; pass empty string to clear phone. */
  phoneNumber?: string | null;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
  isVerified?: boolean;
};

type UsersApiResponse = {
  users: User[];
  limit: number;
  offset: number;
};

/** GET /users/:id */
export async function fetchUserById(id: string): Promise<User> {
  const res = await authFetch(`/users/${encodeURIComponent(id)}`);
  const data = await readAuthJson<{ user: User }>(res);
  return data.user;
}

/** POST /users */
export async function postUser(input: CreateUserInput): Promise<User> {
  const res = await authFetch('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const data = await readAuthJson<{ user: User }>(res);
  return data.user;
}

/** PATCH /users/:id */
export async function patchUser(
  id: string,
  patch: UpdateUserInput,
): Promise<User> {
  const res = await authFetch(`/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  const data = await readAuthJson<{ user: User }>(res);
  return data.user;
}

/** DELETE /users/:id */
export async function removeUser(id: string): Promise<{
  message: string;
  id: string;
}> {
  const res = await authFetch(`/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return readAuthJson<{ message: string; id: string }>(res);
}

export type UseUsersParams = {
  /** Capped at 200 by the API. */
  limit?: number;
  offset?: number;
  /** When false, call `refetch()` manually. */
  autoFetch?: boolean;
};

export function useUsers(params: UseUsersParams = {}) {
  const {
    limit: limitParam = 200,
    offset: offsetParam = 0,
    autoFetch = true,
  } = params;

  const [users, setUsers] = useState<User[]>([]);
  const [limit, setLimit] = useState(limitParam);
  const [offset, setOffset] = useState(offsetParam);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(
    async (nextLimit?: number, nextOffset?: number) => {
      const l = nextLimit ?? limitParam;
      const o = nextOffset ?? offsetParam;
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch(
          `/users?limit=${encodeURIComponent(String(l))}&offset=${encodeURIComponent(String(o))}`,
        );
        const data = await readAuthJson<UsersApiResponse>(res);
        setUsers(data.users);
        setLimit(data.limit);
        setOffset(data.offset);
      } catch (e) {
        setUsers([]);
        setError(
          e instanceof AuthApiError
            ? e.message
            : 'Could not load users. Try signing in as an admin.',
        );
      } finally {
        setLoading(false);
      }
    },
    [limitParam, offsetParam],
  );

  useEffect(() => {
    if (!autoFetch) {
      setLoading(false);
      return;
    }
    void fetchUsers(limitParam, offsetParam);
  }, [autoFetch, fetchUsers, limitParam, offsetParam]);

  const refetch = useCallback(() => {
    return fetchUsers(limitParam, offsetParam);
  }, [fetchUsers, limitParam, offsetParam]);

  const getUserById = useCallback((id: string) => fetchUserById(id), []);

  const createUser = useCallback(
    async (input: CreateUserInput) => {
      const created = await postUser(input);
      await fetchUsers(limitParam, offsetParam);
      return created;
    },
    [fetchUsers, limitParam, offsetParam],
  );

  const updateUser = useCallback(
    async (id: string, patch: UpdateUserInput) => {
      const updated = await patchUser(id, patch);
      await fetchUsers(limitParam, offsetParam);
      return updated;
    },
    [fetchUsers, limitParam, offsetParam],
  );

  const deleteUser = useCallback(
    async (id: string) => {
      const result = await removeUser(id);
      await fetchUsers(limitParam, offsetParam);
      return result;
    },
    [fetchUsers, limitParam, offsetParam],
  );

  return {
    users,
    limit,
    offset,
    loading,
    error,
    refetch,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
  };
}
