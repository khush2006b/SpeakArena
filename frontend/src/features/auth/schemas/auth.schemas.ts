/**
 * Zod Validation Schemas — Auth
 *
 * Single source of truth for all auth-related form validation.
 * Shared across both client (React Hook Form) and server (API
 * response validation). Importing from here ensures consistency.
 */

import * as z from "zod";

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required." })
    .email({ message: "Enter a valid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
  rememberMe: z.boolean().default(false).optional(),
});

export type LoginValues = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, { message: "Name must be at least 2 characters." })
      .max(80, { message: "Name must be under 80 characters." }),
    email: z
      .string()
      .min(1, { message: "Email is required." })
      .email({ message: "Enter a valid email address." }),
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters." })
      .regex(/[A-Z]/, { message: "Include at least one uppercase letter (A-Z)." })
      .regex(/[a-z]/, { message: "Include at least one lowercase letter (a-z)." })
      .regex(/[0-9]/, { message: "Include at least one number (0-9)." })
      .regex(/[^A-Za-z0-9]/, { message: "Include at least one special character (!@#$%^&*)." }),
    confirmPassword: z.string().min(1, { message: "Please confirm your password." }),
    // Role is always 'student' for public sign-up — not exposed in the UI
    role: z.literal("student").default("student"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type RegisterValues = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Forgot Password
// ---------------------------------------------------------------------------

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required." })
    .email({ message: "Enter a valid email address." }),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

// ---------------------------------------------------------------------------
// Reset Password
// ---------------------------------------------------------------------------

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters." })
      .regex(/[A-Z]/, { message: "Include at least one uppercase letter (A-Z)." })
      .regex(/[a-z]/, { message: "Include at least one lowercase letter (a-z)." })
      .regex(/[0-9]/, { message: "Include at least one number (0-9)." })
      .regex(/[^A-Za-z0-9]/, { message: "Include at least one special character (!@#$%^&*)." }),
    confirmPassword: z.string().min(1, { message: "Please confirm your password." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
