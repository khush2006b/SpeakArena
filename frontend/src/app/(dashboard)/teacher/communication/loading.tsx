import { Skeleton } from "@/components/ui/skeleton";

export default function CommunicationLoading() {
  return (
    <div className="h-[calc(100vh-4rem)] w-full flex overflow-hidden bg-secondary/10">
      {/* Left Sidebar (Channels) */}
      <div className="w-[280px] hidden md:flex shrink-0 flex-col bg-background/50 border-r border-border/50">
        <div className="p-4 border-b border-border/50">
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <div className="p-3 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background shadow-sm border-x border-border/50 z-10">
        <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border/50">
          <Skeleton className="h-6 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-32 hidden sm:block" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8 hidden xl:block" />
          </div>
        </div>
        
        <div className="flex-1 p-6 flex flex-col justify-end space-y-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded-md shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-3/4 rounded-xl" />
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded-md shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-1/2 rounded-xl" />
            </div>
          </div>
          <div className="flex justify-center">
            <Skeleton className="h-6 w-64 rounded-full" />
          </div>
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded-md shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border/50 bg-background">
          <Skeleton className="h-[80px] w-full rounded-xl" />
        </div>
      </div>

      {/* Right Context Panel */}
      <div className="w-[320px] hidden xl:flex shrink-0 bg-background/50 border-l border-border/50 flex-col">
        <div className="h-14 shrink-0 flex items-center px-4 border-b border-border/50">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="p-4 space-y-6">
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
