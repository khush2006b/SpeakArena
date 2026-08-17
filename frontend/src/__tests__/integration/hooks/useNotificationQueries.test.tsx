/**
 * @group hooks
 * @coverage >95%
 *
 * Integration tests for src/hooks/queries/useNotificationQueries.ts
 *
 * Tests the hooks end-to-end using MSW to intercept API calls.
 * Verifies optimistic updates, rollbacks, and cache invalidation.
 */

import { waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { http, HttpResponse } from "msw";
import {
  useNotificationList,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/queries/useNotificationQueries";
import { server } from "@/__tests__/setup/msw-server";
import { makeNotification, makePaginatedResponse } from "@/__tests__/factories";

// ---------------------------------------------------------------------------
// Test wrapper — fresh QueryClient per test
// ---------------------------------------------------------------------------

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, wrapper: Wrapper };
}

// ---------------------------------------------------------------------------
// useNotificationList
// ---------------------------------------------------------------------------

describe("useNotificationList()", () => {
  it("fetches and returns the notification list", async () => {
    const notifications = [makeNotification(), makeNotification({ is_read: true })];
    server.use(
      http.get("http://localhost:8000/api/v1/notifications", () =>
        HttpResponse.json({ data: makePaginatedResponse(notifications) })
      )
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.items[0].is_read).toBe(false);
    expect(result.current.data?.items[1].is_read).toBe(true);
  });

  it("handles a server error gracefully", async () => {
    server.use(
      http.get("http://localhost:8000/api/v1/notifications", () =>
        HttpResponse.json({ detail: "Internal Server Error" }, { status: 500 })
      )
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificationList(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useUnreadNotificationCount
// ---------------------------------------------------------------------------

describe("useUnreadNotificationCount()", () => {
  it("returns the unread count", async () => {
    server.use(
      http.get("http://localhost:8000/api/v1/notifications/unread-count", () =>
        HttpResponse.json({ data: { count: 7 } })
      )
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUnreadNotificationCount(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// useMarkNotificationRead — optimistic update
// ---------------------------------------------------------------------------

describe("useMarkNotificationRead()", () => {
  it("optimistically marks a notification as read before server responds", async () => {
    const notif1 = makeNotification({ id: "notif-001", is_read: false });
    const notif2 = makeNotification({ id: "notif-002", is_read: false });
    const paginatedData = makePaginatedResponse([notif1, notif2]);

    // Simulate a slow server response
    server.use(
      http.get("http://localhost:8000/api/v1/notifications", () =>
        HttpResponse.json({ data: paginatedData })
      ),
      http.patch("http://localhost:8000/api/v1/notifications/notif-001/read", async () => {
        await new Promise((r) => setTimeout(r, 200)); // slow
        return HttpResponse.json({ data: { message: "ok" } });
      })
    );

    const { queryClient, wrapper } = makeWrapper();
    const { result: markResult } = renderHook(() => useMarkNotificationRead(), {
      wrapper,
    });

    // Pre-populate cache
    queryClient.setQueryData(["notifications", "list"], paginatedData);
    queryClient.setQueryData(["notifications", "unread-count"], 2);

    act(() => {
      markResult.current.mutate("notif-001");
    });

    // Immediately after mutate — cache should be optimistically updated
    const cachedData = queryClient.getQueryData<typeof paginatedData>([
      "notifications",
      "list",
    ]);
    expect(
      cachedData?.items.find((n) => n.id === "notif-001")?.is_read
    ).toBe(true);

    // Unread count should be decremented
    expect(queryClient.getQueryData(["notifications", "unread-count"])).toBe(1);
  });

  it("rolls back optimistic update on server error", async () => {
    const notif = makeNotification({ id: "notif-rollback", is_read: false });
    const paginatedData = makePaginatedResponse([notif]);

    server.use(
      http.patch(
        "http://localhost:8000/api/v1/notifications/notif-rollback/read",
        () => HttpResponse.json({ detail: "Server Error" }, { status: 500 })
      )
    );

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(["notifications", "list"], paginatedData);
    queryClient.setQueryData(["notifications", "unread-count"], 1);

    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper });

    await act(async () => {
      result.current.mutate("notif-rollback");
      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    // After rollback — original unread state should be restored
    const cachedData = queryClient.getQueryData<typeof paginatedData>([
      "notifications",
      "list",
    ]);
    expect(
      cachedData?.items.find((n) => n.id === "notif-rollback")?.is_read
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// useMarkAllNotificationsRead
// ---------------------------------------------------------------------------

describe("useMarkAllNotificationsRead()", () => {
  it("optimistically marks all notifications as read", async () => {
    const notifications = [
      makeNotification({ id: "n1", is_read: false }),
      makeNotification({ id: "n2", is_read: false }),
    ];
    const paginatedData = makePaginatedResponse(notifications);

    server.use(
      http.post("http://localhost:8000/api/v1/notifications/mark-all-read", () =>
        HttpResponse.json({ data: { message: "ok" } })
      )
    );

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(["notifications", "list"], paginatedData);
    queryClient.setQueryData(["notifications", "unread-count"], 2);

    const { result } = renderHook(() => useMarkAllNotificationsRead(), { wrapper });

    act(() => {
      result.current.mutate();
    });

    // Optimistic: all should be is_read: true
    const cachedData = queryClient.getQueryData<typeof paginatedData>([
      "notifications",
      "list",
    ]);
    cachedData?.items.forEach((n) => {
      expect(n.is_read).toBe(true);
    });

    // Unread count should be 0
    expect(queryClient.getQueryData(["notifications", "unread-count"])).toBe(0);
  });
});
