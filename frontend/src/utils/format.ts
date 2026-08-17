/**
 * Pure formatting utility functions.
 *
 * All date, time, currency, file size, and duration formatters
 * live here. These are pure functions with no side effects.
 * Import selectively — all functions are individually tree-shakeable.
 */

import { format, formatDistanceToNow, parseISO, isValid } from "date-fns";

// ---------------------------------------------------------------------------
// Date & Time
// ---------------------------------------------------------------------------

/**
 * Format an ISO date string to a human-readable date.
 * @example formatDate("2024-01-15T10:30:00Z") // "Jan 15, 2024"
 */
export function formatDate(isoString: string): string {
  const date = parseISO(isoString);
  if (!isValid(date)) return "Invalid date";
  return format(date, "MMM d, yyyy");
}

/**
 * Format an ISO date string to a human-readable datetime.
 * @example formatDateTime("2024-01-15T10:30:00Z") // "Jan 15, 2024, 10:30 AM"
 */
export function formatDateTime(isoString: string): string {
  const date = parseISO(isoString);
  if (!isValid(date)) return "Invalid date";
  return format(date, "MMM d, yyyy, h:mm a");
}

/**
 * Format an ISO date string as relative time.
 * @example formatRelativeTime("2024-01-15T10:30:00Z") // "2 hours ago"
 */
export function formatRelativeTime(isoString: string): string {
  const date = parseISO(isoString);
  if (!isValid(date)) return "Unknown";
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Format a meeting scheduled time.
 * @example formatMeetingTime("2024-01-15T14:00:00Z") // "Mon, Jan 15 at 2:00 PM"
 */
export function formatMeetingTime(isoString: string): string {
  const date = parseISO(isoString);
  if (!isValid(date)) return "TBD";
  return format(date, "EEE, MMM d 'at' h:mm a");
}

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------

/**
 * Format duration in seconds to mm:ss or hh:mm:ss.
 * Used by the video player timeline.
 * @example formatDuration(3725) // "1:02:05"
 * @example formatDuration(125) // "2:05"
 */
export function formatDuration(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

/**
 * Format duration in seconds to a human-readable string.
 * @example formatDurationLong(3725) // "1h 2m"
 * @example formatDurationLong(125) // "2m 5s"
 */
export function formatDurationLong(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

/**
 * Format an amount in the smallest currency unit (paise/cents) to
 * a human-readable currency string.
 *
 * @param amount - Amount in smallest unit (e.g., paise for INR)
 * @param currency - ISO 4217 currency code (default: INR)
 * @example formatCurrency(49900, "INR") // "₹499"
 */
export function formatCurrency(
  amount: number,
  currency = "INR",
  locale = "en-IN",
): string {
  const displayAmount = amount / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(displayAmount);
}

// ---------------------------------------------------------------------------
// File size
// ---------------------------------------------------------------------------

/**
 * Format a file size in bytes to a human-readable string.
 * @example formatFileSize(1536000) // "1.5 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/**
 * Format a large number with K/M suffixes.
 * @example formatCompactNumber(12400) // "12.4K"
 */
export function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(n);
}

/**
 * Truncate a string to a maximum length with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Get initials from a full name (max 2 characters).
 * @example getInitials("John Doe") // "JD"
 * @example getInitials("Alice") // "A"
 */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Generate a deterministic, consistent HSL color from a string.
 * Used for avatar fallback background colors.
 */
export function stringToHslColor(str: string, saturation = 60, lightness = 45): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
