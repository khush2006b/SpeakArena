/**
 * Shared Zod schema fragments.
 *
 * Reusable validators imported by form schemas across the app.
 * Each validator is a Zod schema segment, not a full object schema.
 * Full object schemas live alongside their feature forms.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// String validators
// ---------------------------------------------------------------------------

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const fullNameSchema = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be less than 100 characters")
  .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes");

export const phoneSchema = z
  .string()
  .regex(/^[+]?[0-9]{10,15}$/, "Please enter a valid phone number");

export const urlSchema = z
  .string()
  .url("Please enter a valid URL")
  .optional()
  .or(z.literal(""));

export const otpSchema = z
  .string()
  .length(6, "OTP must be exactly 6 digits")
  .regex(/^[0-9]+$/, "OTP must contain only numbers");

// ---------------------------------------------------------------------------
// Content validators
// ---------------------------------------------------------------------------

export const courseTitleSchema = z
  .string()
  .min(5, "Title must be at least 5 characters")
  .max(200, "Title must be less than 200 characters");

export const courseDescriptionSchema = z
  .string()
  .min(20, "Description must be at least 20 characters")
  .max(5000, "Description must be less than 5000 characters");

export const priceSchema = z
  .number()
  .nonnegative("Price cannot be negative")
  .max(1_000_000, "Price is too high");

// ---------------------------------------------------------------------------
// File validators
// ---------------------------------------------------------------------------

export const MAX_VIDEO_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024;         // 50MB
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;        // 5MB

export const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export const ALLOWED_PDF_TYPES = new Set(["application/pdf"]);

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function validateFile(
  file: File,
  allowedTypes: Set<string>,
  maxSizeBytes: number,
): string | null {
  if (!allowedTypes.has(file.type)) {
    return `File type not supported. Allowed: ${[...allowedTypes].join(", ")}`;
  }
  if (file.size > maxSizeBytes) {
    const maxMB = Math.round(maxSizeBytes / 1024 / 1024);
    return `File is too large. Maximum size is ${maxMB}MB.`;
  }
  return null;
}
