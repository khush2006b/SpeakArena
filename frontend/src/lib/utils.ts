/**
 * Shared utility functions for the SpeakArena frontend.
 *
 * This module re-exports the `cn` class-name merge utility used
 * throughout every component. It is the single source of truth
 * for Tailwind class composition.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS class names with conflict resolution.
 *
 * Combines `clsx` (conditional class logic) with `tailwind-merge`
 * (Tailwind-aware deduplication). Use this instead of raw string
 * concatenation or clsx alone.
 *
 * @param inputs - Class values to merge.
 * @returns A single deduplicated class string.
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-primary", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const THUMBNAIL_FALLBACKS = [
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='225' viewBox='0 0 400 225'><defs><linearGradient id='g1' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e1b4b'/><stop offset='100%' stop-color='%234338ca'/></linearGradient></defs><rect width='400' height='225' fill='url(%23g1)'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='225' viewBox='0 0 400 225'><defs><linearGradient id='g2' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23064e3b'/><stop offset='100%' stop-color='%23059669'/></linearGradient></defs><rect width='400' height='225' fill='url(%23g2)'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='225' viewBox='0 0 400 225'><defs><linearGradient id='g3' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23581c87'/><stop offset='100%' stop-color='%237e22ce'/></linearGradient></defs><rect width='400' height='225' fill='url(%23g3)'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='225' viewBox='0 0 400 225'><defs><linearGradient id='g4' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e293b'/><stop offset='100%' stop-color='%23334155'/></linearGradient></defs><rect width='400' height='225' fill='url(%23g4)'/></svg>",
];

/**
 * Resolves a raw course object or thumbnail key/URL to a valid full image URL or fallback SVG data URI.
 */
export function getCourseThumbnailUrl(raw: any, fallbackIndex = 0): string {
  if (!raw) return THUMBNAIL_FALLBACKS[fallbackIndex % THUMBNAIL_FALLBACKS.length];

  const rawThumb = typeof raw === "string"
    ? raw
    : (raw.thumbnail_url ?? raw.thumbnailUrl ?? raw.thumbnail_r2_key ?? raw.thumbnail ?? raw.cover_image ?? null);

  if (!rawThumb) {
    return THUMBNAIL_FALLBACKS[fallbackIndex % THUMBNAIL_FALLBACKS.length];
  }

  if (
    rawThumb.startsWith("http://") ||
    rawThumb.startsWith("https://") ||
    rawThumb.startsWith("data:") ||
    rawThumb.startsWith("/")
  ) {
    return rawThumb;
  }

  const publicBase =
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
    "https://pub-24a225d578474f4fb5b75f2a90813a11.r2.dev";
  return `${publicBase.replace(/\/$/, "")}/${rawThumb.replace(/^\//, "")}`;
}
