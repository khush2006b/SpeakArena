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
