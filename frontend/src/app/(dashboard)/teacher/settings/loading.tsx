import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] h-[calc(100vh-4rem)] flex overflow-hidden border-x border-border/50 bg-secondary/10">
      
      {/* Left Navigation */}
      <div className="w-[280px] hidden lg:flex shrink-0 flex-col bg-background/50 border-r border-border/50 h-[calc(100vh-4rem)] p-4 space-y-8">
        {[1, 2, 3].map(group => (
          <div key={group} className="space-y-3">
            <Skeleton className="h-3 w-24 mb-2" />
            <div className="space-y-2">
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Settings Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background shadow-sm relative z-10">
        
        {/* Header */}
        <div className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-border/50 bg-background/95">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-64 rounded-md hidden sm:block" />
        </div>
        
        <div className="flex-1 p-6 lg:p-10 max-w-4xl w-full mx-auto space-y-6">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-border/50 shadow-sm p-6 space-y-6">
              <div>
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>

            <div className="rounded-xl border border-border/50 shadow-sm p-6 space-y-6">
              <div>
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
