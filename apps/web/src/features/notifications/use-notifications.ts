"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MarkAllReadResponse,
  NotificationPage,
  NotificationResource,
  ResolveNotificationResponse,
  UnreadCountResponse,
} from "@tournament/api-client";

import { api, apiGet } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** Action Required notifications — unresolved only. Loaded separately from the Updates feed. */
export function useActionRequired() {
  return useQuery({
    queryKey: queryKeys.notifications.actionRequired(),
    queryFn: () => apiGet<NotificationResource[]>("/notifications/action-required"),
    refetchInterval: 60_000,
  });
}

/** Cursor-paginated Important / Info notification feed (newest first, excludes action_required). */
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

/** Badge count — action_required unreads only. */
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

async function resolveNotification(id: string): Promise<ResolveNotificationResponse> {
  const { data } = await api.post<ResolveNotificationResponse>(`/notifications/${id}/resolve`);
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.actionRequired() });
    },
  });
}

export function useResolveNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resolveNotification,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.actionRequired() });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.actionRequired() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(false) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(true) });
    },
  });
}
