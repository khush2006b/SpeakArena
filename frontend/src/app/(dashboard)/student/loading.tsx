import React from "react";

export default function StudentDashboardLoading() {
  return (
    <div className="space-y-8 p-6 animate-pulse">
      {/* Hero Skeleton */}
      <div className="h-48 w-full rounded-3xl bg-muted/40 border border-border/30" />

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-muted/30 border border-border/30" />
        ))}
      </div>

      {/* Main Content Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 rounded-2xl bg-muted/30 border border-border/30" />
        ))}
      </div>
    </div>
  );
}
