import { Skeleton } from "@/components/ui/skeleton";

export default function MeetingsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-8 pb-24 space-y-8 min-h-screen flex flex-col">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-48 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-full sm:w-64 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md hidden md:block" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>

      {/* Stats Skeleton */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
        ))}
      </div>
      
      {/* Split Pane Skeleton */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-[600px]">
        {/* Calendar Skeleton */}
        <div className="flex-1 rounded-xl border border-border/50 bg-card shadow-sm p-4 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-border/50 pb-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-px bg-border/50 border border-border/50 rounded-lg overflow-hidden">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="bg-card min-h-[100px] p-2" />
            ))}
          </div>
        </div>

        {/* Agenda Skeleton */}
        <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-4 rounded-xl border border-border/50 bg-card shadow-sm p-4">
          <Skeleton className="h-6 w-24 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
