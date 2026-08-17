import { Skeleton } from "@/components/ui/skeleton";

export default function FinanceLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-8 pb-24 space-y-8 min-h-screen flex flex-col">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pb-6 border-b border-border/50">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64 rounded-md" />
          <Skeleton className="h-4 w-96 rounded-md" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-48 rounded-md hidden md:block" />
          <Skeleton className="h-9 w-28 rounded-md hidden sm:block" />
          <Skeleton className="h-9 w-9 rounded-md hidden sm:block" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* KPI Skeleton */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
        ))}
      </div>

      {/* Insights Panel Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[80px] w-full rounded-xl" />
          ))}
        </div>
      </div>
      
      {/* Chart Grid Skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Skeleton className="h-[400px] w-full rounded-xl xl:col-span-2" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>

      {/* Map Skeleton */}
      <Skeleton className="h-[400px] w-full rounded-xl" />

      {/* Table Skeleton */}
      <Skeleton className="h-[500px] w-full rounded-xl mt-8" />
    </div>
  );
}
