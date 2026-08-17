/**
 * Global Error Handler Utilities
 *
 * Provides a consistent, typed approach to handling API errors
 * across the entire application. All error-handling logic lives
 * here — components only call these helpers, never inspect raw errors.
 *
 * Covers:
 *   - 400 Bad Request (validation)
 *   - 401 Unauthorized (session expired)
 *   - 403 Forbidden (role mismatch)
 *   - 404 Not Found
 *   - 409 Conflict
 *   - 422 Unprocessable Entity (field errors)
 *   - 500 Internal Server Error
 *   - Network errors (offline)
 */

import type { APIError } from "@/types";

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isAPIError(error: unknown): error is APIError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "code" in error &&
    "message" in error
  );
}

export function isNetworkError(error: unknown): boolean {
  return isAPIError(error) && error.code === "NETWORK_ERROR";
}

export function isUnauthorized(error: unknown): boolean {
  return isAPIError(error) && error.status === 401;
}

export function isForbidden(error: unknown): boolean {
  return isAPIError(error) && error.status === 403;
}

export function isNotFound(error: unknown): boolean {
  return isAPIError(error) && error.status === 404;
}

export function isValidationError(error: unknown): boolean {
  return isAPIError(error) && (error.status === 422 || error.status === 400);
}

export function isConflict(error: unknown): boolean {
  return isAPIError(error) && error.status === 409;
}

export function isServerError(error: unknown): boolean {
  return isAPIError(error) && error.status >= 500;
}

// ---------------------------------------------------------------------------
// Human-readable message resolver
// ---------------------------------------------------------------------------

export function getErrorMessage(error: unknown): string {
  if (isAPIError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred. Please try again.";
}

/**
 * Extract field-level validation errors from an API 422 response.
 * Returns a flat map: { fieldName: "error message" }
 */
export function getFieldErrors(
  error: unknown,
): Record<string, string> | null {
  if (!isAPIError(error) || !error.detail) return null;
  return Object.fromEntries(
    Object.entries(error.detail).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages[0] : messages,
    ]),
  );
}

/**
 * Map backend field errors into React Hook Form setError calls.
 * Usage: mapServerErrorsToForm(error, form.setError)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapServerErrorsToForm(
  error: unknown,
  // Accept any RHF setError signature
  setError: (name: string, error: { type: string; message: string }) => void,
): void {
  const fieldErrors = getFieldErrors(error);
  if (!fieldErrors) return;
  Object.entries(fieldErrors).forEach(([field, message]) => {
    setError(field, { type: "server", message });
  });
}
