/**
 * useNotificationSocket — Real-time Notification Hook
 *
 * Connects to the /notifications Socket.IO namespace and writes
 * incoming real-time notifications into the TanStack Query cache.
 * This means the Notification Center UI updates INSTANTLY without
 * any polling — the background query interval is only a fallback.
 *
 * This hook should be mounted once at the app shell level (e.g.,
 * inside the DashboardLayout) when the user is authenticated.
 */

"use client";

import { useEffect } from "react";


export function useNotificationSocket() {
  // Socket notifications disabled temporarily: the backend does not currently 
  // expose a /ws/notifications route. Real-time updates rely on TanStack Query polling.
  useEffect(() => {
    return () => {};
  }, []);
}
