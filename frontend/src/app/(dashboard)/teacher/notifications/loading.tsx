import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] h-[calc(100vh-4rem)] flex overflow-hidden border-x border-border/50 bg-secondary/10">
      {/* Left Sidebar (Categories) */}
      <div className="w-[260px] hidden md:flex shrink-0 flex-col bg-background/50 border-r border-border/50 p-4 space-y-2">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <div className="my-4 border-t border-border/50" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>

      {/* Main Feed */}
      <div className="flex-1 flex flex-col min-w-0 bg-background shadow-sm z-10">
        <div className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-border/50 bg-background">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md hidden md:block" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-4 p-4 border-b border-border/50">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-3 w-3/4" />
                <div className="flex gap-3 pt-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Details Panel */}
      <div className="w-[400px] hidden xl:flex shrink-0 bg-background/50 border-l border-border/50 flex-col">
        <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border/50">
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex-1 p-6 space-y-8">
          <div>
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="space-y-4 pt-4 border-t border-border/50">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
