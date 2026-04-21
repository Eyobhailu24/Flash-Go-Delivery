"use client";

import { useCallback, useState } from "react";
import { authFetch, readAuthJson } from "@/lib/auth-api";

export type Notification = {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  readStatus: boolean;
  createdAt: string;
};

type NotificationsListResponse = {
  notifications: Notification[];
};

export async function fetchMyNotifications(params?: {
  limit?: number;
  unreadOnly?: boolean;
}): Promise<Notification[]> {
  const q = new URLSearchParams();
  if (params?.limit != null) {
    q.set("limit", String(params.limit));
  }
  if (params?.unreadOnly === true) {
    q.set("unreadOnly", "true");
  }
  const qs = q.toString();
  const path = `/notifications/me${qs ? `?${qs}` : ""}`;
  const res = await authFetch(path);
  const data = await readAuthJson<NotificationsListResponse>(res);
  return data.notifications;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(
    async (params?: { limit?: number; unreadOnly?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchMyNotifications(params);
        setNotifications(list);
      } catch (e) {
        setNotifications([]);
        setError(
          e instanceof Error ? e.message : "Could not load notifications.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    notifications,
    loading,
    error,
    loadNotifications,
  };
}
