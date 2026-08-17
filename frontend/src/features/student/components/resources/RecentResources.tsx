"use client";

import * as React from "react";
import { ResourceCard } from "./ResourceCard";
import { apiClient } from "@/services/api/client";
import { Loader2 } from "lucide-react";
import { useResourcesStore } from "@/stores/resources.store";

export function RecentResources() {
  const { viewMode } = useResourcesStore();
  const [resources, setResources] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await apiClient.get("/api/v1/courses?page=1&page_size=5");
        const courseResources = (response.data?.items || []).map((course: any) => ({
          id: course.id,
          title: course.title,
          course: course.title,
          type: "document",
          size: "N/A",
          updatedAt: course.created_at,
          icon: "FileText",
        }));
        setResources(courseResources);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourses();
  }, []);

  if (isLoading) {
    return (
      <div className="mb-12">
        <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
          Recently Accessed
        </h3>
        <div className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary opacity-60" />
        </div>
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="mb-12">
        <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
          Recently Accessed
        </h3>
        <div className="py-8 flex justify-center text-sm text-muted-foreground">
          No recent resources found.
        </div>
      </div>
    );
  }

  return (
    <div className="mb-12">
      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
        Recently Accessed
      </h3>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {resources.map((res) => (
            <ResourceCard key={res.id} resource={res} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1 border border-border/50 rounded-xl p-1 bg-card/30 backdrop-blur">
          {resources.map((res) => (
            <ResourceCard key={res.id} resource={res} />
          ))}
        </div>
      )}
    </div>
  );
}
