"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useChatStore } from "@/stores/chat.store";
import { useAuthStore } from "@/stores/auth.store";
import { apiClient } from "@/services/api/client";

function getCourseTeacherId(course: any): string {
  if (!course) return "";
  const id =
    course.teacher_id ||
    course.teacherId ||
    course.teacher?.id ||
    course.teacher_info?.id ||
    course.instructor_id ||
    course.instructorId ||
    course.created_by ||
    course.createdBy ||
    course.user_id;
  return id ? String(id) : "";
}

export function ChatUnreadTracker() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { setChannelUnread } = useChatStore();

  useEffect(() => {
    if (!user?.id) return;
    const currentUserId = String(user.id);

    const checkAllChannels = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (!useAuthStore.getState().user?.id) return;

      try {
        // Step 1: Server-authoritative backend endpoint
        const unreadRes = await apiClient.get("/api/v1/chat/unread");
        const unreadData = unreadRes.data?.data ?? unreadRes.data ?? {};
        const serverChannels = unreadData.unread_channels;

        if (serverChannels && typeof serverChannels === "object" && Object.keys(serverChannels).length > 0) {
          for (const [chKey, isUnread] of Object.entries(serverChannels)) {
            setChannelUnread(chKey, Boolean(isUnread));
          }
          return;
        }
      } catch {
        // Fall back to client-side verification if server endpoint is waking up
      }

      // Step 2: Resilient client-side fallback
      try {
        const coursesRes = await apiClient.get("/api/v1/courses");
        const raw = coursesRes.data;
        let courses: any[] = [];
        if (Array.isArray(raw?.data)) courses = raw.data;
        else if (Array.isArray(raw?.data?.items)) courses = raw.data.items;
        else if (Array.isArray(raw?.items)) courses = raw.items;
        else if (Array.isArray(raw)) courses = raw;

        if (courses.length === 0) return;

        for (const course of courses.slice(0, 6)) {
          const courseId = course.course_id || course.id;
          if (!courseId) continue;
          const teacherId = getCourseTeacherId(course);

          // Check General Talk
          try {
            const genRes = await apiClient.get(`/api/v1/chat/${courseId}/messages?limit=5&room_type=general&public_only=true`);
            const genMsgs: any[] = genRes.data?.data?.messages ?? genRes.data?.messages ?? [];
            const otherGen = genMsgs.filter((m: any) => {
              const sid = m.sender_id || m.sender?.id;
              return String(sid) !== currentUserId;
            });
            if (otherGen.length > 0) {
              const latest = otherGen[0];
              const lastRead = typeof window !== "undefined"
                ? (localStorage.getItem(`sa_read_course:${courseId}`) || localStorage.getItem(`sa_last_read_msg_${courseId}`))
                : null;
              setChannelUnread(`course:${courseId}`, !lastRead || latest.id !== lastRead);
            } else {
              setChannelUnread(`course:${courseId}`, false);
            }
          } catch {}

          // Check Announcements
          try {
            const annRes = await apiClient.get(`/api/v1/chat/${courseId}/messages?limit=5&room_type=announcement&announcements_only=true`);
            const annMsgs: any[] = annRes.data?.data?.messages ?? annRes.data?.messages ?? [];
            const otherAnn = annMsgs.filter((m: any) => {
              const sid = m.sender_id || m.sender?.id;
              return String(sid) !== currentUserId;
            });
            if (otherAnn.length > 0) {
              const latest = otherAnn[0];
              const lastRead = typeof window !== "undefined" ? localStorage.getItem(`sa_read_course_announcements:${courseId}`) : null;
              setChannelUnread(`course_announcements:${courseId}`, !lastRead || latest.id !== lastRead);
            } else {
              setChannelUnread(`course_announcements:${courseId}`, false);
            }
          } catch {}

          // Check Teacher DM
          if (teacherId) {
            try {
              const dmRes = await apiClient.get(`/api/v1/chat/${courseId}/messages?limit=5&dm_student_id=${teacherId}`);
              const dmMsgs: any[] = dmRes.data?.data?.messages ?? dmRes.data?.messages ?? [];
              const otherDm = dmMsgs.filter((m: any) => {
                const sid = m.sender_id || m.sender?.id;
                return String(sid) !== currentUserId;
              });
              if (otherDm.length > 0) {
                const latest = otherDm[0];
                const lastRead = typeof window !== "undefined" ? localStorage.getItem(`sa_read_teacher_dm:${teacherId}`) : null;
                setChannelUnread(`teacher_dm:${teacherId}`, !lastRead || latest.id !== lastRead);
              } else {
                setChannelUnread(`teacher_dm:${teacherId}`, false);
              }
            } catch {}
          }
        }
      } catch {}
    };

    checkAllChannels();
    const interval = setInterval(checkAllChannels, 15000);

    return () => clearInterval(interval);
  }, [pathname, user?.id, setChannelUnread]);

  return null;
}
