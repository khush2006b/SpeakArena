/**
 * Notification Query Hooks
 */

"use client";

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { notificationService } from "@/services/notification.service";
import { queryKeys } from "@/lib/queryKeys";
import type { PaginationConfig } from "@/types";

export function useNotificationList(pagination?: PaginationConfig) {
  return useQuery({
    queryKey: queryKeys.notifications.list(pagination as unknown as Record<string, unknown>),
    queryFn: () => notificationService.list(pagination),
    refetchInterval: 60_000,
  });
}

export function useNotificationListInfinite() {
  return useInfiniteQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: ({ pageParam = 1 }) =>
      notificationService.list({ page: pageParam as number, pageSize: 20 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? lastPage.page + 1 : undefined,
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 30_000,
    staleTime: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all() });

      // Snapshot the previous value
      const previousNotifications = queryClient.getQueryData(queryKeys.notifications.list());
      const previousUnreadCount = queryClient.getQueryData(queryKeys.notifications.unreadCount());

      // Optimistically update to the new value
      queryClient.setQueriesData(
        { queryKey: queryKeys.notifications.list() },
        (old: any) => {
          if (!old) return old;
          if (old.items) {
            return {
              ...old,
              items: old.items.map((notif: any) =>
                notif.id === id ? { ...notif, is_read: true } : notif
              ),
            };
          }
          if (old.pages) {
            return {
              ...old,
              pages: old.pages.map((page: any) => ({
                ...page,
                items: page.items.map((notif: any) =>
                  notif.id === id ? { ...notif, is_read: true } : notif
                ),
              })),
            };
          }
          return old;
        }
      );

      queryClient.setQueryData(queryKeys.notifications.unreadCount(), (old: any) => {
        return Math.max(0, (old as number || 1) - 1);
      });

      // Return a context object with the snapshotted value
      return { previousNotifications, previousUnreadCount };
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (_err, _newTodo, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(queryKeys.notifications.list(), context.previousNotifications);
      }
      if (context?.previousUnreadCount !== undefined) {
        queryClient.setQueryData(queryKeys.notifications.unreadCount(), context.previousUnreadCount);
      }
    },
    // Always refetch after error or success:
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all() });

      const previousNotifications = queryClient.getQueryData(queryKeys.notifications.list());
      const previousUnreadCount = queryClient.getQueryData(queryKeys.notifications.unreadCount());

      queryClient.setQueriesData(
        { queryKey: queryKeys.notifications.list() },
        (old: any) => {
          if (!old) return old;
          if (old.items) {
            return { ...old, items: old.items.map((notif: any) => ({ ...notif, is_read: true })) };
          }
          if (old.pages) {
            return {
              ...old,
              pages: old.pages.map((page: any) => ({
                ...page,
                items: page.items.map((notif: any) => ({ ...notif, is_read: true })),
              })),
            };
          }
          return old;
        }
      );

      queryClient.setQueryData(queryKeys.notifications.unreadCount(), 0);

      return { previousNotifications, previousUnreadCount };
    },
    onError: (_err, _newTodo, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(queryKeys.notifications.list(), context.previousNotifications);
      }
      if (context?.previousUnreadCount !== undefined) {
        queryClient.setQueryData(queryKeys.notifications.unreadCount(), context.previousUnreadCount);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}
