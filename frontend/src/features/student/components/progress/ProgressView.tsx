"use client";

import React from "react";
import { Trophy, Award, Download, CheckCircle2, Flame, Clock } from "lucide-react";

export function ProgressView() {
  const certificates = [
    {
      id: "cert-1",
      title: "Certificate of Excellence in Public Speaking",
      course: "Mastering Public Speaking & Rhetoric",
      issueDate: "Aug 4, 2026",
      credentialId: "SA-CERT-2026-8891",
    },
    {
      id: "cert-2",
      title: "Foundations of Debate & Critical Thinking",
      course: "Advanced Debate & Argumentation",
      issueDate: "Jul 18, 2026",
      credentialId: "SA-CERT-2026-4412",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 min-h-screen bg-background relative overflow-hidden">
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
                <Trophy className="h-3 w-3" /> Level 4 Speaker
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
              14 Days
            </p>
            <p className="text-xs font-medium text-emerald-500">Personal best record!</p>
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
              38.5 hrs
            </p>
            <p className="text-xs text-muted-foreground">+4.2 hrs this week</p>
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
              2 Courses
            </p>
            <p className="text-xs font-medium text-emerald-500">100% completion rate</p>
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
              2 Certificates
            </p>
            <p className="text-xs text-muted-foreground">Verified & Shareable</p>
          </div>
        </div>

        {/* Certificates Section */}
        <div className="space-y-4">
          <h3 className="text-responsive-lg tracking-tight flex items-center gap-2 text-foreground font-extrabold">
            <Award className="h-5 w-5 text-primary" /> Official Certificates
          </h3>

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
                    Issued for completing <span className="font-semibold text-foreground">{cert.course}</span> on {cert.issueDate}
                  </p>
                </div>

                <button
                  onClick={() => {
                    const dlUrl = `/api/v1/certificates/${cert.credentialId}/download`;
                    window.open(dlUrl, '_blank');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all btn-outline press-scale bg-card border-border text-muted-foreground hover:text-primary hover:border-primary/50"
                >
                  <Download className="h-4 w-4 text-primary" /> Download PDF Certificate
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
