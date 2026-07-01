"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MarkAllReadResponse,
  NotificationPage,
  NotificationResource,
  UnreadCountResponse,
} from "@tournament/api-client";

import { api, apiGet } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** Cursor-paginated notification feed (newest first). */
export function useNotifications(unreadOnly = false) {
  return useInfiniteQuery({
    queryKey: queryKeys.notifications.list(unreadOnly),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiGet<NotificationPage>("/notifications", {
        params: { unreadOnly, cursor: pageParam ?? undefined, limit: 20 },
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Unread badge count — polled so the bell stays fresh without a socket. */
export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => apiGet<UnreadCountResponse>("/notifications/unread-count"),
    refetchInterval: 60_000,
  });
}

async function markRead(id: string): Promise<NotificationResource> {
  const { data } = await api.post<NotificationResource>(`/notifications/${id}/read`);
  return data;
}

async function markAllRead(): Promise<MarkAllReadResponse> {
  const { data } = await api.post<MarkAllReadResponse>("/notifications/read-all");
  return data;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
