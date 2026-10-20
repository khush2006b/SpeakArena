export type MeetingStatusType = "LIVE" | "UPCOMING" | "ENDED" | "CANCELLED";

/**
 * Calculates real-time meeting status based on scheduled time, duration, and current timestamp.
 * 
 * - LIVE: Current time is between start and end time (or backend marked status as LIVE).
 * - UPCOMING: Current time is before start time.
 * - ENDED: Current time is after end time (or backend marked as ENDED / COMPLETED / EXPIRED).
 * - CANCELLED: Backend marked as CANCELLED or ARCHIVED.
 */
export function getMeetingStatus(meeting: any, nowMs: number = Date.now()): MeetingStatusType {
  if (!meeting) return "ENDED";
  
  const rawStatus = String(meeting.status || "").toUpperCase();
  if (rawStatus === "CANCELLED" || rawStatus === "ARCHIVED") {
    return "CANCELLED";
  }
  if (rawStatus === "ENDED" || rawStatus === "COMPLETED" || rawStatus === "EXPIRED") {
    return "ENDED";
  }

  const startIso = meeting.scheduledAt || meeting.scheduled_at;
  if (!startIso) return "ENDED";

  const startMs = new Date(startIso).getTime();
  if (isNaN(startMs)) return "ENDED";

  const durMinutes = Number(meeting.durationMinutes || meeting.duration_minutes || 60);
  const endMs = startMs + durMinutes * 60 * 1000;

  if (rawStatus === "LIVE" || (nowMs >= startMs && nowMs <= endMs)) {
    return "LIVE";
  } else if (nowMs < startMs) {
    return "UPCOMING";
  } else {
    return "ENDED";
  }
}
