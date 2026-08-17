/**
 * Dashboard shell layout.
 *
 * Applied to all authenticated routes. Performs server-side
 * session validation — unauthenticated users are redirected to /login
 * before any UI renders (zero flash).
 *
 * The layout renders the application shell: sidebar + header + main
 * content area. The actual Sidebar and Header components are Client
 * Components imported here.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ROUTES } from "@/constants/routes";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function getServerSession(): Promise<boolean> {
  // We check for the sa_auth cookie as a proxy for authentication on the server.
  // We cannot check refresh_token because its path is restricted to /api/v1/auth/refresh
  // and the browser will not send it to page routes.
  // The actual user validation happens in AuthProvider client-side.
  const cookieStore = await cookies();
  return cookieStore.get("sa_auth")?.value === "1";
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuthenticated = await getServerSession();

  if (!isAuthenticated) {
    redirect(ROUTES.LOGIN);
  }

  return <>{children}</>;
}
