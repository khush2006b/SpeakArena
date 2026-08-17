"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Play, CheckCircle2, BarChart3, Users, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ROUTES } from "@/constants/routes";


const FADE_UP_ANIMATION_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

const FLOAT_ANIMATION = {
  y: [-8, 8, -8],
  transition: {
    duration: 6,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

export function HeroSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative w-full overflow-hidden bg-background pt-24 pb-16 md:pt-32 md:pb-24 lg:pt-40 lg:pb-32">
      {/* Background Grid & Premium Ambient Glow */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="ambient-glow top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      <div className="ambient-glow bottom-0 right-[-20%] translate-y-1/2 opacity-10 bg-gradient-to-r from-blue-500/20 to-purple-500/20" />

      <div className="container relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-8 items-center">
          
          {/* Left: Content */}
          <motion.div
            initial="hidden"
            animate="show"
            viewport={{ once: true }}
            variants={{
              hidden: {},
              show: {
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
            className="flex flex-col items-start text-left"
          >
            <motion.div variants={FADE_UP_ANIMATION_VARIANTS}>
              <Badge variant="secondary" className="mb-6 rounded-full px-4 py-1.5 glass-panel text-primary hover:bg-white/10 transition-colors cursor-pointer border-white/5">
                <span className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  SpeakArena 2.0 is now live
                </span>
              </Badge>
            </motion.div>

            <motion.h1 
              variants={FADE_UP_ANIMATION_VARIANTS}
              className="text-4xl font-extrabold tracking-tighter text-foreground sm:text-5xl lg:text-6xl xl:text-7xl drop-shadow-sm"
            >
              Master Spoken English <br className="hidden sm:block" />
              with <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-blue-400">live teacher sessions.</span>
            </motion.h1>

            <motion.p 
              variants={FADE_UP_ANIMATION_VARIANTS}
              className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl font-medium tracking-tight"
            >
              The premier interactive platform for English fluency. Practice live speaking on Google Meet, master accent reduction, business English, and IELTS prep with real-time feedback.
            </motion.p>

            <motion.div 
              variants={FADE_UP_ANIMATION_VARIANTS}
              className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto relative"
            >
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              <Button asChild size="lg" className="relative w-full sm:w-auto h-12 px-8 text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all group">
                <Link href={ROUTES.REGISTER}>
                  Start Learning Free
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 text-base elevation-1">
                <Link href="/student/courses">
                  Explore English Batches
                </Link>
              </Button>
            </motion.div>

            <motion.div 
              variants={FADE_UP_ANIMATION_VARIANTS}
              className="mt-12 flex flex-col sm:flex-row items-center gap-6 border-t border-white/5 pt-8 w-full"
            >
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <Avatar key={i} className="border-2 border-background h-10 w-10">
                    <AvatarFallback className="bg-primary/20 text-xs text-primary font-semibold">S{i}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1 text-yellow-500">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground mt-1 tracking-tight">
                  <span className="font-semibold text-foreground">10,000+</span> fluent speakers empowered
                </span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: Abstract UI Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2, type: "spring", stiffness: 100 }}
            className="relative mx-auto w-full max-w-lg lg:max-w-none mt-10 lg:mt-0 perspective-1000"
          >
            {/* Main Application Window Mockup */}
            <div className="relative rounded-2xl elevation-2 overflow-hidden aspect-[4/3] transform-gpu hover:rotate-y-2 transition-transform duration-700 ring-1 ring-white/10">
              {/* Window Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
                </div>
                <div className="mx-auto h-5 w-48 rounded-md bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" />
              </div>
              
              {/* Mock Video Player */}
              <div className="relative w-full h-[60%] bg-zinc-950 border-b border-white/5 flex items-center justify-center group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent" />
                <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center backdrop-blur-xl border border-primary/30 group-hover:scale-110 group-hover:bg-primary/30 transition-all shadow-[0_0_30px_rgba(var(--primary),0.3)]">
                  <Play className="h-6 w-6 text-primary fill-primary ml-1" />
                </div>
                {/* Progress bar mock */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3">
                  <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-[65%] bg-primary shadow-[0_0_10px_rgba(var(--primary),0.8)]" />
                  </div>
                  <span className="text-[10px] text-white/50 font-mono tracking-wider">14:32</span>
                </div>
              </div>

              {/* Mock Chat / IDE Sidebar */}
              <div className="flex h-[40%] bg-white/[0.01]">
                <div className="w-2/3 p-5 space-y-4">
                  <div className="h-3 w-3/4 rounded-sm bg-white/10" />
                  <div className="h-3 w-1/2 rounded-sm bg-white/10" />
                  <div className="h-3 w-5/6 rounded-sm bg-white/5" />
                </div>
                <div className="w-1/3 border-l border-white/5 p-4 space-y-3 bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded-full bg-primary/20" />
                    <div className="h-2 w-16 rounded-sm bg-white/10" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded-full bg-emerald-500/20" />
                    <div className="h-2 w-12 rounded-sm bg-white/10" />
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Card 1: Meeting Preview */}
            <motion.div
              animate={shouldReduceMotion ? {} : FLOAT_ANIMATION}
              className="absolute -left-12 top-1/4 rounded-xl elevation-1 p-4 hidden md:flex items-center gap-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 ring-1 ring-blue-500/20">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground tracking-tight">Live Session</p>
                <p className="text-xs text-muted-foreground font-medium">Starting in 5 mins</p>
              </div>
            </motion.div>

            {/* Floating Card 2: Analytics */}
            <motion.div
              animate={shouldReduceMotion ? {} : FLOAT_ANIMATION}
              style={{ animationDelay: "1s" }}
              className="absolute -right-8 top-1/2 rounded-xl elevation-1 p-4 hidden md:flex items-center gap-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground tracking-tight">Top 1%</p>
                <p className="text-xs text-muted-foreground font-medium">Class ranking</p>
              </div>
            </motion.div>

            {/* Floating Card 3: Success */}
            <motion.div
              animate={shouldReduceMotion ? {} : FLOAT_ANIMATION}
              style={{ animationDelay: "2s" }}
              className="absolute -bottom-6 left-10 rounded-xl elevation-1 p-3 hidden md:flex items-center gap-3 pr-6"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/30">
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground tracking-tight">Assignment graded: A+</p>
            </motion.div>

          </motion.div>

        </div>
      </div>
    </section>
  );
}
