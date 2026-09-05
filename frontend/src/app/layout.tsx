import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppProviders } from "@/providers/AppProviders";
import { Toaster } from "sonner";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { GlobalErrorBoundary } from "@/components/ui/GlobalErrorBoundary";
import { SkipToMainContent } from "@/components/layout/SkipToMainContent";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

import { NavigationProgressBar } from "@/components/layout/NavigationProgressBar";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env["NEXT_PUBLIC_APP_URL"] ?? "https://speakarena.com",
  ),
  title: {
    default: "Speak Arena — Master Spoken English & Accent Reduction Online",
    template: "%s | Speak Arena",
  },
  description:
    "Master Spoken English, Accent Reduction, Business Communication, and IELTS Exam Prep with Speak Arena. Expert-led live Google Meet classes and interactive learning.",
  keywords: [
    "spoken english",
    "accent reduction",
    "business english",
    "IELTS speaking",
    "public speaking",
    "online english class",
  ],
  authors: [{ name: "Speak Arena" }],
  creator: "Speak Arena",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: process.env["NEXT_PUBLIC_APP_URL"] ?? "https://speakarena.com",
    siteName: "Speak Arena",
    title: "Speak Arena — Master Spoken English & Accent Reduction Online",
    description:
      "Master Spoken English, Accent Reduction, and IELTS preparation with live Google Meet classes.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Speak Arena — Master Spoken English & Accent Reduction Online",
    description: "Expert-led English courses with live Google Meet practice.",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: ["/icon-32.png", "/icon.svg"],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  themeColor: "#080c14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased bg-background text-foreground transition-colors duration-200" suppressHydrationWarning>
        <NavigationProgressBar />
        <SkipToMainContent />
        <GlobalErrorBoundary>
          <AppProviders>
            <div id="main-content" className="contents">
              {children}
            </div>
          </AppProviders>
          <Toaster position="bottom-right" richColors />
          <OfflineBanner />
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
