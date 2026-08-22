"use client";

import React, { useEffect, useState } from "react";
import { Trophy, Award, Download, CheckCircle2, Flame, Clock } from "lucide-react";
import { apiClient } from "@/services/api/client";
import { Skeleton } from "@/components/ui/skeleton";

export function ProgressView() {
  const [profile, setProfile] = useState<any>(null);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [profRes, certRes] = await Promise.allSettled([
          apiClient.get('/api/v1/profile'),
          apiClient.get('/api/v1/certificates?page=1&page_size=10')
        ]);
        
        if (profRes.status === 'fulfilled') {
          setProfile(profRes.value.data);
        }
        if (certRes.status === 'fulfilled') {
          setCertificates(certRes.value.data.items || certRes.value.data.certificates || []);
        } else {
          setCertificates([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto w-full py-8 space-y-8 bg-background">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  const getLevel = (courses: number) => {
    if (courses >= 6) return "Advanced Speaker";
    if (courses >= 3) return "Intermediate Speaker";
    if (courses >= 1) return "Learner Speaker";
    return "Beginner Speaker";
  };

  const completedCourses = profile?.total_courses_completed || 0;

  return (
    <div className="mx-auto w-full py-8 space-y-8 bg-background relative overflow-hidden">
      <div className="grid-bg absolute inset-0 opacity-40 pointer-events-none" />
      <div className="glow-indigo absolute pointer-events-none" style={{ width: 400, height: 400, top: -100, left: "50%", transform: "translateX(-50%)" }} />

      <div className="relative z-10 space-y-8">
        {/* Header */}
        <div className="pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="tracking-tight text-foreground font-extrabold text-responsive-xl" style={{ letterSpacing: "-0.03em" }}>
                Progress & Certificates
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-500">
                <Trophy className="h-3 w-3" /> {getLevel(completedCourses)}
              </span>
            </div>
            <p className="text-sm mt-1 text-muted-foreground page-subtitle" style={{ lineHeight: 1.7 }}>
              Track your course completions, earned badges, and official SpeakArena certificates.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl p-5 space-y-2 card-glass hover-lift" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Learning Streak
              </span>
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
                <Flame className="h-4 w-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold tracking-tight text-foreground">
              {profile?.streak_days || 0} Days
            </p>
          </div>

          <div className="rounded-2xl p-5 space-y-2 card-glass hover-lift" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Hours Studied
              </span>
              <div className="p-2 rounded-xl bg-blue-500/15 text-blue-500">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold tracking-tight text-foreground">
              {profile?.total_hours || 0} hrs
            </p>
          </div>

          <div className="rounded-2xl p-5 space-y-2 card-glass hover-lift" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Courses Completed
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold tracking-tight text-foreground">
              {completedCourses} Courses
            </p>
          </div>

          <div className="rounded-2xl p-5 space-y-2 card-glass hover-lift" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Certificates Issued
              </span>
              <div className="p-2 rounded-xl bg-purple-500/15 text-purple-500">
                <Award className="h-4 w-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold tracking-tight text-foreground">
              {certificates.length} Certificates
            </p>
          </div>
        </div>

        {/* Certificates Section */}
        <div className="space-y-4">
          <h3 className="text-responsive-lg tracking-tight flex items-center gap-2 text-foreground font-extrabold">
            <Award className="h-5 w-5 text-primary" /> Official Certificates
          </h3>

          {certificates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card/50 rounded-2xl border border-border">
              Complete a course to earn your first certificate!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="rounded-2xl p-4 sm:p-6 flex flex-col justify-between space-y-4 relative overflow-hidden card-glass hover-lift"
                  style={{ borderRadius: 16 }}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-500">
                        <CheckCircle2 className="h-3 w-3" /> Verified
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {cert.credentialId}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-foreground">
                      {cert.title}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Issued for completing <span className="font-semibold text-foreground">{cert.course}</span> on {cert.issueDate || new Date().toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    disabled={!cert.credentialId}
                    onClick={() => {
                      if (cert.credentialId) {
                        const dlUrl = `/api/v1/certificates/${cert.credentialId}/download`;
                        window.open(dlUrl, '_blank');
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all btn-outline press-scale bg-card border-border text-muted-foreground hover:text-primary hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="h-4 w-4 text-primary" /> Download PDF Certificate
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
