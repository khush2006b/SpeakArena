"use client";

import * as React from "react";
import { ResourceCard } from "./ResourceCard";
import { apiClient } from "@/services/api/client";
import { Loader2 } from "lucide-react";
import { useResourcesStore } from "@/stores/resources.store";
import { motion } from "framer-motion";

export function ResourcesGrid() {
  const { viewMode, searchQuery } = useResourcesStore();
  const [resources, setResources] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await apiClient.get("/api/v1/courses?page=1&page_size=20");
        // Mapping courses to resources for display
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

  const filteredResources = React.useMemo(() => {
    if (!searchQuery) return resources;
    const q = searchQuery.toLowerCase();
    return resources.filter(
      (r) =>
        r.title.toLowerCase().includes(q) || r.course.toLowerCase().includes(q)
    );
  }, [searchQuery, resources]);

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-60" />
      </div>
    );
  }

  if (filteredResources.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center opacity-60">
        <p className="text-sm font-bold text-foreground">
          No resources found.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Try adjusting your search query or filters.
        </p>
      </div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const item = {
    hidden: { opacity: 0, scale: 0.95 },
    show: {
      opacity: 1,
      scale: 1,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  };

  return (
    <div>
      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
        All Resources
      </h3>

      {viewMode === "grid" ? (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {filteredResources.map((res) => (
            <motion.div key={res.id} variants={item}>
              <ResourceCard resource={res} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-1 border border-border/50 rounded-xl p-1 bg-card/30 backdrop-blur"
        >
          {filteredResources.map((res) => (
            <motion.div key={res.id} variants={item}>
              <ResourceCard resource={res} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
