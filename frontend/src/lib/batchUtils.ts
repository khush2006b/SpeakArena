import { format } from "date-fns";

export interface BatchEnrollmentInfo {
  enrolledAt: Date | null;
  expiresAt: Date | null;
  daysEnrolled: number;
  daysRemaining: number;
  totalDays: number;
  percentTimeElapsed: number;
  timeSpentLabel: string;
  remainingLabel: string;
  formattedEnrolledDate: string;
  formattedExpiryDate: string;
  isExpiringSoon: boolean; // <= 5 days remaining
  isExpired: boolean;
  statusBadge: {
    label: string;
    variant: "normal" | "warning" | "expired";
  };
}

/**
 * Calculates batch time spent, remaining duration, and expiry status for an enrolled course.
 * Based on the 1-month (30-day) auto-unenrollment policy.
 */
export function getBatchEnrollmentInfo(item: any): BatchEnrollmentInfo {
  const now = new Date();

  // 1. Resolve enrolled_at
  const rawEnrolled =
    item?.enrolled_at ||
    item?.enrolledAt ||
    item?.joinedAt ||
    item?.created_at ||
    item?.createdAt;
  const enrolledAt = rawEnrolled ? new Date(rawEnrolled) : null;

  // 2. Total batch duration (default: 30 days)
  const totalDays = Number(item?.batch_duration_days || item?.batchDurationDays || 30);

  // 3. Resolve expires_at
  const rawExpires = item?.expires_at || item?.expiresAt;
  let expiresAt: Date | null = null;
  if (rawExpires) {
    expiresAt = new Date(rawExpires);
  } else if (enrolledAt) {
    expiresAt = new Date(enrolledAt.getTime() + totalDays * 24 * 60 * 60 * 1000);
  }

  // 4. Days enrolled (how long in batch so far)
  let daysEnrolled = 0;
  if (typeof item?.days_enrolled === "number") {
    daysEnrolled = Math.max(0, item.days_enrolled);
  } else if (typeof item?.daysEnrolled === "number") {
    daysEnrolled = Math.max(0, item.daysEnrolled);
  } else if (enrolledAt) {
    const diffMs = now.getTime() - enrolledAt.getTime();
    daysEnrolled = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  // 5. Days remaining until auto-unenrollment
  let daysRemaining = totalDays;
  if (typeof item?.days_remaining === "number") {
    daysRemaining = Math.max(0, item.days_remaining);
  } else if (typeof item?.daysRemaining === "number") {
    daysRemaining = Math.max(0, item.daysRemaining);
  } else if (expiresAt) {
    const diffMs = expiresAt.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  const isExpired = expiresAt ? now.getTime() > expiresAt.getTime() : false;
  const isExpiringSoon = !isExpired && daysRemaining <= 5;

  const percentTimeElapsed = Math.min(
    100,
    Math.max(0, Math.round(((totalDays - daysRemaining) / totalDays) * 100))
  );

  const formattedEnrolledDate = enrolledAt ? format(enrolledAt, "MMM d, yyyy") : "N/A";
  const formattedExpiryDate = expiresAt ? format(expiresAt, "MMM d, yyyy") : "N/A";

  const timeSpentLabel =
    daysEnrolled === 0
      ? "Day 1 in batch (Joined today)"
      : `${daysEnrolled} day${daysEnrolled === 1 ? "" : "s"} in batch`;

  let remainingLabel = "";
  if (isExpired) {
    remainingLabel = "Batch expired";
  } else if (daysRemaining === 0) {
    remainingLabel = "Expires today";
  } else if (daysRemaining === 1) {
    remainingLabel = "1 day left";
  } else {
    remainingLabel = `${daysRemaining} days left`;
  }

  let statusVariant: "normal" | "warning" | "expired" = "normal";
  let statusLabel = "";

  if (isExpired) {
    statusVariant = "expired";
    statusLabel = "Batch Expired";
  } else if (isExpiringSoon) {
    statusVariant = "warning";
    statusLabel = `Expires in ${daysRemaining}d`;
  } else {
    statusVariant = "normal";
    statusLabel = `${daysRemaining}d left`;
  }

  return {
    enrolledAt,
    expiresAt,
    daysEnrolled,
    daysRemaining,
    totalDays,
    percentTimeElapsed,
    timeSpentLabel,
    remainingLabel,
    formattedEnrolledDate,
    formattedExpiryDate,
    isExpiringSoon,
    isExpired,
    statusBadge: {
      label: statusLabel,
      variant: statusVariant,
    },
  };
}
