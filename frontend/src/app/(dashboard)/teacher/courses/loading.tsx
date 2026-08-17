import { Skeleton } from "@/components/ui/skeleton";

export default function CourseManagementLoading() {
  return (
    <div className="w-full">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" /> {/* Breadcrumb */}
          <Skeleton className="h-9 w-64" /> {/* Title */}
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24 hidden md:block" />
          <Skeleton className="h-9 w-24 hidden md:block" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="space-y-6">
        {/* Stats Skeleton */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
        
        {/* Toolbar Skeleton */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
          <Skeleton className="h-10 w-full sm:max-w-md rounded-md" />
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Skeleton className="h-10 w-24 rounded-md hidden sm:block" />
            <Skeleton className="h-10 w-24 rounded-md hidden sm:block" />
            <Skeleton className="h-10 w-10 rounded-md" />
            <Skeleton className="h-10 w-20 rounded-md" />
          </div>
        </div>
        
        {/* Grid/List Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-[320px] rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
