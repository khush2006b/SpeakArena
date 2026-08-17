"use client";

import React from "react";
import Link from "next/link";
import { Play, Clock, ArrowRight, BookOpen, Sparkles } from "lucide-react";

export function ResumeView() {
  const lastLesson = {
    courseId: "course-1",
    courseTitle: "Mastering Public Speaking & Rhetoric",
    lessonId: "les-3",
    lessonTitle: "Stage Presence & Non-Verbal Communication",
    progressPercent: 65,
    timestamp: "18:45 / 28:30",
    instructor: "Dr. Eleanor Vance",
  };

  const nextUpLessons = [
    {
      id: "les-4",
      title: "Vocal Modulation & Pitch Control",
      duration: "22 mins",
      course: "Mastering Public Speaking & Rhetoric",
    },
    {
      id: "les-5",
      title: "Handling Q&A Sessions Like a Pro",
      duration: "18 mins",
      course: "Mastering Public Speaking & Rhetoric",
    },
    {
      id: "les-6",
      title: "Structuring Impromptu Speeches",
      duration: "25 mins",
      course: "Advanced Debate & Argumentation",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-up">

      {/* Header */}
      <div className="border-b border-border/40 pb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-responsive-xl font-extrabold tracking-tight text-foreground">
            Continue Learning
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary border border-primary/20">
            <Sparkles className="h-3 w-3" /> Auto-Saved
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Pick up right where you left off in your active courses.
        </p>
      </div>

      {/* Hero Active Lesson Card */}
      <div className="relative overflow-hidden card-glass grid-bg hover-lift">
        {/* Ambient glow */}
        <div className="glow-indigo absolute -top-10 -left-10 pointer-events-none" />

        <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
              <Play className="h-3.5 w-3.5 fill-primary" /> Last Watched Session
            </span>
            <h2 className="text-responsive-lg font-extrabold tracking-tight text-foreground">
              {lastLesson.lessonTitle}
            </h2>
            <p className="text-sm text-muted-foreground">
              Course:{" "}
              <span className="text-foreground font-semibold">
                {lastLesson.courseTitle}
              </span>{" "}
              • {lastLesson.instructor}
            </p>

            {/* Progress Bar */}
            <div className="space-y-1.5 pt-2 max-w-md">
              <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>Completed {lastLesson.progressPercent}%</span>
                <span>{lastLesson.timestamp}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${lastLesson.progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <Link
            href={`/student/courses/${lastLesson.courseId}`}
            className="btn-primary inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-bold shadow-xl shadow-primary/25 hover:scale-105 press-scale shrink-0"
          >
            <Play className="h-5 w-5 fill-current" />
            Resume Video
          </Link>
        </div>
      </div>

      {/* Next Up List */}
      <div className="space-y-4">
        <h3 className="text-responsive-md font-bold tracking-tight text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" /> Next Up in Your Queue
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {nextUpLessons.map((lesson) => (
            <div
              key={lesson.id}
              className="card-glass hover-lift p-5 flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {lesson.course}
                </span>
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {lesson.title}
                </h4>
              </div>

              <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground border-t border-border/30 mt-4">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {lesson.duration}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-primary group-hover:translate-x-1 transition-transform">
                  Start <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
