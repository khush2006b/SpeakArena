/**
 * Environment Variable Validation
 *
 * Validates and exports all required environment variables at build/startup.
 * Using this pattern means the app fails fast at startup rather than
 * mysteriously at runtime when a variable is missing.
 *
 * Client-side variables must be prefixed with NEXT_PUBLIC_.
 */

function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. Add it to .env.local.`,
    );
  }
  return value;
}

export const env = {
  // API
  apiUrl: getEnvVar("NEXT_PUBLIC_API_URL", "https://speakarena.onrender.com"),
  socketUrl: getEnvVar(
    "NEXT_PUBLIC_SOCKET_URL",
    process.env["NEXT_PUBLIC_API_URL"] ?? "https://speakarena.onrender.com",
  ),

  // App
  appName: getEnvVar("NEXT_PUBLIC_APP_NAME", "SpeakArena"),
  appUrl: getEnvVar("NEXT_PUBLIC_APP_URL", "https://speak-arena.vercel.app"),

  // Razorpay (public key only — secret NEVER exposed to client)
  razorpayKeyId: getEnvVar("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_placeholder"),
} as const;

export type Env = typeof env;
