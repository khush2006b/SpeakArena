"use client";

import * as React from "react";
import { Play, Star, ChevronLeft, ChevronRight, Mic, Briefcase, Award, BookOpen, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { apiClient } from "@/services/api/client";

import { getCourseThumbnailUrl } from "@/lib/utils";

interface CourseItem {
  id: string;
  title: string;
  thumbnail?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
  thumbnail_r2_key?: string;
  gradient?: string;
  iconType?: string;
  category?: string;
  progress?: number;
  lastWatched?: string;
  teacherName?: string;
  rating?: number;
}

interface CourseCarouselProps {
  title: string;
  type: "enrolled" | "recommended";
}

function getCourseIcon(iconType?: string) {
  switch (iconType) {
    case "mic": return Mic;
    case "briefcase": return Briefcase;
    case "award": return Award;
    case "book": return BookOpen;
    default: return Volume2;
  }
}

export function CourseCarousel({ title, type }: CourseCarouselProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = React.useState(false);
  const [showRightScroll, setShowRightScroll] = React.useState(true);
  const [failedImages, setFailedImages] = React.useState<Record<string, boolean>>({});
  const [items, setItems] = React.useState<CourseItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchCourses = async () => {
      try {
        const endpoint = type === "enrolled" 
          ? "/api/v1/courses?enrolled=true&page=1&page_size=6" 
          : "/api/v1/courses?page=1&page_size=6";
        const res = await apiClient.get(endpoint);
        const data = res.data?.items || res.data?.data || res.data || [];
        setItems(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourses();
  }, [type]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftScroll(scrollLeft > 0);
    setShowRightScroll(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = direction === "left" ? -400 : 400;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  const handleImageError = (id: string) => {
    setFailedImages((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="space-y-4 relative group">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-responsive-xl tracking-tight text-foreground font-extrabold">{title}</h2>
        
        {/* Scroll Controls (Desktop only) */}
        <div className="hidden md:flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 btn-outline press-scale" 
            onClick={() => scroll("left")}
            disabled={!showLeftScroll}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 btn-outline press-scale" 
            onClick={() => scroll("right")}
            disabled={!showRightScroll}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl" style={{ WebkitOverflowScrolling: "touch" }}>
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 pb-4 snap-x snap-mandatory custom-scrollbar"
        >
          {isLoading ? (
            <div className="flex items-center justify-center w-full py-12">
              <div className="animate-pulse flex space-x-4">
                <div className="rounded-xl bg-muted h-32 w-64"></div>
                <div className="rounded-xl bg-muted h-32 w-64"></div>
              </div>
            </div>
          ) : items.map((item, idx) => {
            const Icon = getCourseIcon(item.iconType);
            const courseId = item.id || (item as any).course_id || (item as any)._id || `carousel-item-${idx}`;
            const isImageFailed = failedImages[courseId];
            const thumbUrl = getCourseThumbnailUrl(item, idx);
            const defaultGradient = item.gradient || "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--background)) 100%)";

            return (
              <Link href={`/student/courses/${courseId}`} className="block shrink-0 snap-start w-[280px] sm:w-[320px]" key={courseId}>
              <div 
                className="group/card cursor-pointer p-3 rounded-2xl transition-all duration-300 card-glass hover-lift h-full"
                style={{ borderRadius: 16 }}
              >
                {/* Thumbnail / Gradient Banner */}
                <div className="relative aspect-video rounded-xl overflow-hidden mb-3" style={{ background: defaultGradient }}>
                  {!isImageFailed && thumbUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumbUrl}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                      onError={() => handleImageError(courseId)}
                    />
                  ) : null}

                  {/* Fallback Graphic Banner when image is missing / failed */}
                  {(isImageFailed || !thumbUrl) && (
                    <div className="absolute inset-0 flex flex-col justify-between p-4" style={{ background: defaultGradient }}>
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/15 backdrop-blur-sm">
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        {item.category && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-white/90 line-clamp-2 drop-shadow">
                        {item.title}
                      </p>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/20 group-hover/card:bg-black/40 transition-colors" />
                  
                  {/* Play Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <div className="rounded-full p-3 shadow-lg transform scale-90 group-hover/card:scale-100 transition-all bg-primary text-primary-foreground">
                      <Play className="h-6 w-6 fill-current" />
                    </div>
                  </div>

                  {/* Progress Bar overlay for enrolled */}
                  {type === "enrolled" && item.progress !== undefined && (
                    <div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/50">
                      <div className="h-full transition-all duration-500 bg-primary" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                </div>

                {/* Meta */}
                <div className="space-y-1 p-2 sm:p-3">
                  <h3 className="font-semibold line-clamp-1 transition-colors group-hover/card:text-primary text-foreground text-responsive-lg">
                    {item.title}
                  </h3>
                  
                  {type === "enrolled" ? (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{item.progress}% Complete</span>
                      <span>{item.lastWatched}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{item.teacherName}</span>
                      <span className="flex items-center gap-1 font-medium text-amber-500">
                        <Star className="h-3 w-3 fill-current" /> {item.rating}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
