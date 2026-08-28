"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useChatStore } from "@/stores/chat.store";
import { useAuthStore } from "@/stores/auth.store";
import { apiClient } from "@/services/api/client";
import { getChatSocket, socketEvents } from "@/services/socket.client";

export function ChatUnreadTracker() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { setHasUnread, clearUnread } = useChatStore();

  // 1. If student is currently viewing messages or chat, clear unread state
  useEffect(() => {
    if (pathname?.startsWith("/student/messages") || pathname?.startsWith("/student/chat")) {
      clearUnread();
    }
  }, [pathname, clearUnread]);

  // 2. Poll and listen for unread messages / notifications when not on messages page
  useEffect(() => {
    const currentUserId = user?.id ? String(user.id) : "";
    let activeSockets: string[] = [];

    const checkUnread = async () => {
      if (pathname?.startsWith("/student/messages")) return;

      try {
        // Step A: Check unread notifications endpoint
        const res = await apiClient.get("/api/v1/notifications?unread_only=true&page_size=5");
        const raw = res.data;
        const total = raw?.total ?? raw?.data?.total ?? (Array.isArray(raw?.data) ? raw.data.length : 0);

        if (total > 0) {
          setHasUnread(true);
          return;
        }

        // Step B: Check enrolled courses for unread messages from teachers/others
        const coursesRes = await apiClient.get("/api/v1/courses");
        const rawCourses = coursesRes.data?.items ?? coursesRes.data?.data ?? coursesRes.data ?? [];
        const courses = Array.isArray(rawCourses) ? rawCourses : [];

        if (courses.length > 0) {
          for (const course of courses.slice(0, 5)) {
            const courseId = course.course_id || course.id;
            if (!courseId) continue;

            // Connect room WebSocket for real-time unread detection if not already connected
            if (!activeSockets.includes(courseId)) {
              try {
                const socket = getChatSocket(courseId);
                socket.connect();
                socket.on(socketEvents.chat.MESSAGE_RECEIVED, (payload: any) => {
                  const senderId = payload?.sender?.id || payload?.sender_id;
                  if (senderId && String(senderId) !== currentUserId && !pathname?.startsWith("/student/messages")) {
                    setHasUnread(true);
                  }
                });
                activeSockets.push(courseId);
              } catch {}
            }

            try {
              const msgRes = await apiClient.get(`/api/v1/chat/${courseId}/messages?limit=5`);
              const rawMsgs = msgRes.data?.data?.items ?? msgRes.data?.items ?? msgRes.data?.data ?? msgRes.data ?? [];
              const msgs = Array.isArray(rawMsgs) ? rawMsgs : [];

              // Find newest message sent by someone else (e.g. Teacher)
              const otherMsgs = msgs.filter((m: any) => {
                const sid = m.sender?.id || m.sender_id;
                return sid && String(sid) !== currentUserId;
              });

              if (otherMsgs.length > 0) {
                const latestOther = otherMsgs[0];
                const lastReadMsgId = typeof window !== "undefined"
                  ? localStorage.getItem(`sa_last_read_msg_${courseId}`)
                  : null;

                if (latestOther.id && latestOther.id !== lastReadMsgId) {
                  setHasUnread(true);
                  return;
                }
              }
            } catch {
              // ignore room fetch error
            }
          }
        }
      } catch {
        // ignore
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, 10000); // Check every 10 seconds

    return () => {
      clearInterval(interval);
    };
  }, [pathname, user?.id, setHasUnread]);

  return null;
}
