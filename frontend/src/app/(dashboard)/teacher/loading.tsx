import React from "react";

export default function TeacherDashboardLoading() {
  return (
    <div className="space-y-8 p-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="h-20 w-full rounded-2xl bg-muted/40 border border-border/30" />

      {/* Metrics Row Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-muted/30 border border-border/30" />
        ))}
      </div>

      {/* Analytics Chart Skeleton */}
      <div className="h-80 w-full rounded-2xl bg-muted/30 border border-border/30" />
    </div>
  );
}
