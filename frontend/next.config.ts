import type { NextConfig } from "next";

/**
 * SpeakArena Next.js configuration.
 *
 * Security headers are set here for the frontend.
 * Additional headers are set by Nginx for the API.
 */
const nextConfig: NextConfig = {
  // Strict mode for catching React bugs early
  reactStrictMode: true,

  // Don't fail the build on TypeScript or ESLint errors in test files
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Allow images from R2, Unsplash, Google, and avatars
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "storage.speakarena.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatar.iran.liara.run",
        port: "",
        pathname: "/**",
      },
    ],
  },

  // Security headers for the frontend (Nginx adds more for the API)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  // Domain redirects are handled automatically by Vercel's Edge network
  async redirects() {
    return [];
  },

  // Proxy API requests to backend in development to avoid CORS and SameSite cookie issues
  async rewrites() {
    const target = process.env["NEXT_PUBLIC_API_URL"] || "https://speakarena.onrender.com";
    return [
      {
        source: "/api/:path*",
        destination: `${target}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
