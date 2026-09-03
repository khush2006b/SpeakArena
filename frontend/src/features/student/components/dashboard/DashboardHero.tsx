"use client";

import * as React from "react";
import { Play, PlayCircle, Clock, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiClient } from "@/services/api/client";
import { useChatStore } from "@/stores/chat.store";

import { getCourseThumbnailUrl } from "@/lib/utils";

export function DashboardHero() {
  const { hasUnread } = useChatStore();
  const [imageError, setImageError] = React.useState(false);
  const [studentName, setStudentName] = React.useState("");
  const [hero, setHero] = React.useState({
    courseId: "",
    thumbnail: "",
    courseTitle: "Your Learning Journey",
    lessonTitle: "Pick up where you left off",
    progress: 0,
    timeRemaining: "",
  });

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, coursesRes] = await Promise.all([
          apiClient.get("/api/v1/profile"),
          apiClient.get("/api/v1/courses?page=1&page_size=1"),
        ]);

        const profile = profileRes.data?.data ?? profileRes.data ?? {};
        setStudentName(profile.first_name ?? profile.full_name ?? profile.name ?? "");

        const courses = coursesRes.data?.items ?? coursesRes.data?.data ?? coursesRes.data ?? [];
        const latest = Array.isArray(courses) ? courses[0] : null;
        if (latest) {
          const resolvedThumb = getCourseThumbnailUrl(latest);
          setHero({
            courseId: latest.id || latest.course_id || "",
            thumbnail: resolvedThumb,
            courseTitle: latest.title ?? "Your Learning Journey",
            lessonTitle: latest.subtitle ?? "Continue where you left off",
            progress: Math.round(latest.progress_percentage ?? 0),
            timeRemaining: latest.duration ? `${latest.duration} min left` : "",
          });
        }
      } catch {
        // Keep default hero values — don't crash
      }
    };
    fetchData();
  }, []);

  const heroCourseUrl = hero.courseId ? `/student/courses/${hero.courseId}` : "/student/explore";
  const hasEnrolledCourse = Boolean(hero.courseId);

  return (
    <div className="relative w-full min-h-[350px] md:min-h-[450px] lg:min-h-[500px] h-auto overflow-hidden group card-glass" style={{ background: "hsl(var(--card))" }}>
      <div className="grid-bg absolute inset-0 opacity-40 pointer-events-none" />
      <div className="glow-indigo absolute pointer-events-none" style={{ width: 400, height: 400, top: -100, left: "50%", transform: "translateX(-50%)" }} />
      
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        {!imageError && hero.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={hero.thumbnail}
            alt={hero.courseTitle}
            className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : null}
        
        {/* Cinematic Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="absolute inset-0 z-10 flex flex-col justify-end p-4 sm:p-6 lg:p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-2xl space-y-4"
        >
          <div className="inline-flex items-center px-3 py-1 text-xs font-semibold backdrop-blur-md bg-primary/15 border border-primary/30 text-primary badge-primary"
               style={{ borderRadius: 100 }}>
            <Sparkles className="h-3.5 w-3.5 mr-2 text-primary" />
            {studentName ? `Welcome back, ${studentName}!` : "Welcome to Speak Arena!"}
          </div>
          
          <h1 className="drop-shadow-md text-foreground font-extrabold tracking-tighter text-responsive-xl" style={{ fontSize: "clamp(24px, 2.5vw, 36px)" }}>
            {hasEnrolledCourse ? hero.courseTitle : "Start Your Learning Journey"}
          </h1>
          
          <p className="font-medium flex items-center gap-2 drop-shadow text-muted-foreground leading-relaxed text-responsive-lg">
            <PlayCircle className="h-5 w-5 text-primary" />
            {hasEnrolledCourse ? hero.lessonTitle : "Discover top Spoken English & Accent Reduction courses"}
          </p>

          {hasEnrolledCourse && (
            <div className="space-y-2 pt-2 max-w-md">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>{hero.progress}% Completed</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {hero.timeRemaining}</span>
              </div>
              <div className="w-full rounded-full h-1.5 backdrop-blur-sm overflow-hidden bg-border">
                <div 
                  className="h-1.5 rounded-full transition-all duration-1000 ease-out bg-primary" 
                  style={{ width: `${hero.progress}%` }} 
                />
              </div>
            </div>
          )}

          <div className="pt-4 flex flex-wrap items-center gap-3">
            <Link href={heroCourseUrl}>
              <Button size="lg" className="px-6 sm:px-8 text-base shadow-lg transition-transform btn-primary press-scale"
                      style={{ borderRadius: 10 }}>
                <Play className="mr-2 h-5 w-5 fill-current" /> {hasEnrolledCourse ? "Resume Video" : "Explore Courses"}
              </Button>
            </Link>
            <Link href="/student/messages">
              <Button size="lg" variant="secondary" className="px-6 text-base backdrop-blur-md transition-transform flex items-center gap-2 btn-outline press-scale relative"
                      style={{ borderRadius: 10 }}>
                <MessageSquare className="h-4 w-4" />
                <span>Class Chat</span>
                {hasUnread && (
                  <span className="flex h-2.5 w-2.5 relative ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                )}
              </Button>
            </Link>
            <Link href={heroCourseUrl}>
              <Button size="lg" variant="secondary" className="px-6 text-base backdrop-blur-md transition-transform hidden md:flex btn-outline press-scale"
                      style={{ borderRadius: 10 }}>
                {hasEnrolledCourse ? "Overview" : "Catalog"}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
