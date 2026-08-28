"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useChatStore } from "@/stores/chat.store";
import { apiClient } from "@/services/api/client";
import { getNotificationSocket } from "@/services/socket.client";

export function ChatUnreadTracker() {
  const pathname = usePathname();
  const { setHasUnread, clearUnread } = useChatStore();

  // 1. If student is currently viewing messages or chat, clear unread state
  useEffect(() => {
    if (pathname?.startsWith("/student/messages") || pathname?.startsWith("/student/chat")) {
      clearUnread();
      if (typeof window !== "undefined") {
        localStorage.setItem("speakarena_last_chat_read_at", new Date().toISOString());
      }
    }
  }, [pathname, clearUnread]);

  // 2. Poll and listen for unread messages / notifications when not on messages page
  useEffect(() => {
    const checkUnread = async () => {
      if (pathname?.startsWith("/student/messages")) return;

      try {
        // Check unread notifications
        const res = await apiClient.get("/api/v1/notifications?unread_only=true&page_size=5");
        const raw = res.data;
        const total = raw?.total ?? raw?.data?.total ?? (Array.isArray(raw?.data) ? raw.data.length : 0);

        if (total > 0) {
          setHasUnread(true);
          return;
        }

        // Check latest messages in student courses
        const coursesRes = await apiClient.get("/api/v1/courses");
        const rawCourses = coursesRes.data?.items ?? coursesRes.data?.data ?? coursesRes.data ?? [];
        const courses = Array.isArray(rawCourses) ? rawCourses : [];

        if (courses.length > 0) {
          const lastReadIso = typeof window !== "undefined"
            ? localStorage.getItem("speakarena_last_chat_read_at")
            : null;
          const lastReadMs = lastReadIso ? new Date(lastReadIso).getTime() : 0;

          for (const course of courses.slice(0, 3)) {
            const courseId = course.course_id || course.id;
            if (!courseId) continue;
            try {
              const msgRes = await apiClient.get(`/api/v1/chat/${courseId}/messages?limit=1`);
              const msgs = msgRes.data?.data ?? msgRes.data ?? [];
              if (Array.isArray(msgs) && msgs.length > 0) {
                const latest = msgs[0];
                const msgMs = new Date(latest.created_at || latest.createdAt).getTime();
                if (msgMs > lastReadMs) {
                  setHasUnread(true);
                  return;
                }
              }
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, 12000); // Poll every 12 seconds

    // WebSocket real-time event listener
    try {
      const socket = getNotificationSocket();
      socket.connect();
      const handleWsMessage = () => {
        if (!pathname?.startsWith("/student/messages")) {
          setHasUnread(true);
        }
      };
      socket.on("notification.new", handleWsMessage);
      socket.on("message.new", handleWsMessage);

      return () => {
        clearInterval(interval);
        socket.off("notification.new", handleWsMessage);
        socket.off("message.new", handleWsMessage);
      };
    } catch {
      return () => clearInterval(interval);
    }
  }, [pathname, setHasUnread]);

  return null;
}
