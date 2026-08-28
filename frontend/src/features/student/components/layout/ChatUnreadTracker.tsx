"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useChatStore } from "@/stores/chat.store";
import { useAuthStore } from "@/stores/auth.store";
import { apiClient } from "@/services/api/client";

export function ChatUnreadTracker() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { setHasUnread, clearUnread } = useChatStore();

  // 1. Clear unread badge when user visits messages or chat
  useEffect(() => {
    if (pathname?.startsWith("/student/messages") || pathname?.startsWith("/student/chat")) {
      clearUnread();
    }
  }, [pathname, clearUnread]);

  // 2. Periodically check across student courses for any unread messages from teacher
  useEffect(() => {
    const currentUserId = user?.id ? String(user.id) : "";

    const checkUnread = async () => {
      // Skip check if student is actively viewing the messages/chat screen
      if (pathname?.startsWith("/student/messages") || pathname?.startsWith("/student/chat")) {
        return;
      }

      try {
        // Step A: Check unread notifications endpoint
        try {
          const notifRes = await apiClient.get("/api/v1/notifications?unread_only=true&page_size=5");
          const notifRaw = notifRes.data;
          const total = notifRaw?.total ?? notifRaw?.data?.total ?? (Array.isArray(notifRaw?.data) ? notifRaw.data.length : 0);
          if (total > 0) {
            setHasUnread(true);
            return;
          }
        } catch {
          // continue to course check
        }

        // Step B: Fetch student's enrolled courses
        const coursesRes = await apiClient.get("/api/v1/courses");
        let courses: any[] = [];
        const raw = coursesRes.data;
        if (Array.isArray(raw?.data)) courses = raw.data;
        else if (Array.isArray(raw?.data?.items)) courses = raw.data.items;
        else if (Array.isArray(raw?.items)) courses = raw.items;
        else if (Array.isArray(raw)) courses = raw;

        if (courses.length > 0) {
          let foundUnread = false;

          for (const course of courses.slice(0, 8)) {
            const courseId = course.course_id || course.id;
            if (!courseId) continue;

            try {
              // Fetch latest messages for this course room
              const msgRes = await apiClient.get(`/api/v1/chat/${courseId}/messages?limit=10`);
              const msgs: any[] = msgRes.data?.data?.messages ?? msgRes.data?.messages ?? [];

              if (msgs.length > 0) {
                // Find newest message sent by someone else (teacher/classmate)
                const otherMsgs = msgs.filter((m: any) => {
                  const sid = m.sender_id || m.sender?.id;
                  return !currentUserId || String(sid) !== currentUserId;
                });

                if (otherMsgs.length > 0) {
                  const latest = otherMsgs[0];
                  const lastReadId = typeof window !== "undefined"
                    ? localStorage.getItem(`sa_last_read_msg_${courseId}`)
                    : null;

                  // If user has not read this specific latest message
                  if (!lastReadId || latest.id !== lastReadId) {
                    foundUnread = true;
                    setHasUnread(true);
                    return;
                  }
                }
              }
            } catch {
              // Continue checking other courses
            }
          }

          if (!foundUnread) {
            setHasUnread(false);
          }
        }
      } catch {
        // Silently ignore
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, 6000); // Check every 6 seconds

    return () => clearInterval(interval);
  }, [pathname, user?.id, setHasUnread]);

  return null;
}
