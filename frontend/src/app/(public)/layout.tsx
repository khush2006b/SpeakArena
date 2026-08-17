
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0d1117] selection:bg-indigo-500/20">
      <SiteHeader />
      
      <main className="flex-1">{children}</main>
      
      <SiteFooter />
    </div>
  );
}
