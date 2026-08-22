"use client";

import * as React from "react";
import Image from "next/image";
import { Play, PlayCircle, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiClient } from "@/services/api/client";

export function DashboardHero() {
  const [imageError, setImageError] = React.useState(false);
  const [studentName, setStudentName] = React.useState("");
  const [hero, setHero] = React.useState({
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
          setHero({
            thumbnail: latest.thumbnail_url ?? latest.cover_image ?? "",
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

  return (
    <div className="relative w-full min-h-[350px] md:min-h-[450px] lg:min-h-[500px] h-auto overflow-hidden group card-glass" style={{ background: "hsl(var(--card))" }}>
      <div className="grid-bg absolute inset-0 opacity-40 pointer-events-none" />
      <div className="glow-indigo absolute pointer-events-none" style={{ width: 400, height: 400, top: -100, left: "50%", transform: "translateX(-50%)" }} />
      
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        {!imageError && hero.thumbnail ? (
          <Image
            src={hero.thumbnail}
            alt={hero.courseTitle}
            fill
            className="object-cover transition-transform duration-1000 group-hover:scale-105"
            priority
            onError={() => setImageError(true)}
            unoptimized
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
            {studentName ? `Welcome back, ${studentName}!` : "Welcome to SpeakArena!"}
          </div>
          
          <h1 className="drop-shadow-md text-foreground font-extrabold tracking-tighter text-responsive-xl" style={{ fontSize: "clamp(24px, 2.5vw, 36px)" }}>
            {hero.courseTitle}
          </h1>
          
          <p className="font-medium flex items-center gap-2 drop-shadow text-muted-foreground leading-relaxed text-responsive-lg">
            <PlayCircle className="h-5 w-5 text-primary" />
            {hero.lessonTitle}
          </p>

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

          <div className="pt-4 flex items-center gap-3">
            <Link href="/student/courses">
              <Button size="lg" className="px-8 text-base shadow-lg transition-transform btn-primary press-scale"
                      style={{ borderRadius: 10 }}>
                <Play className="mr-2 h-5 w-5 fill-current" /> Resume Video
              </Button>
            </Link>
            <Link href="/student/courses">
              <Button size="lg" variant="secondary" className="px-8 text-base backdrop-blur-md transition-transform hidden sm:flex btn-outline press-scale"
                      style={{ borderRadius: 10 }}>
                Course Overview
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
