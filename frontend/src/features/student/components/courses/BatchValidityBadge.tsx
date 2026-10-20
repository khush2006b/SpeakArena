"use client";

import * as React from "react";
import { Clock, Calendar, AlertTriangle, CheckCircle2, Hourglass } from "lucide-react";
import { getBatchEnrollmentInfo, type BatchEnrollmentInfo } from "@/lib/batchUtils";

interface BatchValidityBadgeProps {
  course: any;
  variant?: "compact" | "card" | "pill" | "banner";
  className?: string;
}

export function BatchValidityBadge({
  course,
  variant = "compact",
  className = "",
}: BatchValidityBadgeProps) {
  const info: BatchEnrollmentInfo = React.useMemo(
    () => getBatchEnrollmentInfo(course),
    [course]
  );

  // If no enrollment date at all, don't render
  if (!info.enrolledAt) return null;

  // 1. Pill variant (ideal for small headers or header action bars)
  if (variant === "pill") {
    if (info.isExpired) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 ${className}`}
          title={`Enrolled: ${info.formattedEnrolledDate} • Expired on: ${info.formattedExpiryDate}`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Batch Expired</span>
        </span>
      );
    }

    if (info.isExpiringSoon) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse ${className}`}
          title={`Enrolled: ${info.formattedEnrolledDate} • Auto-unenrolls: ${info.formattedExpiryDate} (${info.remainingLabel})`}
        >
          <Hourglass className="h-3.5 w-3.5 text-amber-400" />
          <span>{info.remainingLabel} in batch</span>
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20 ${className}`}
        title={`Enrolled: ${info.formattedEnrolledDate} • Auto-unenrolls: ${info.formattedExpiryDate} (${info.remainingLabel})`}
      >
        <Calendar className="h-3.5 w-3.5 text-sky-400" />
        <span>{info.daysRemaining}d left in batch</span>
      </span>
    );
  }

  // 2. Compact variant (for cards in CourseGrid, CourseCarousel, etc.)
  if (variant === "compact") {
    const isExpired = info.isExpired;
    const isExpiringSoon = info.isExpiringSoon;

    const bgStyles = isExpired
      ? "bg-rose-950/60 text-rose-300 border-rose-500/30"
      : isExpiringSoon
      ? "bg-amber-950/60 text-amber-300 border-amber-500/30"
      : "bg-black/60 text-sky-200 border-sky-400/20";

    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md backdrop-blur-md text-[11px] font-medium border ${bgStyles} ${className}`}
        title={`Enrolled: ${info.formattedEnrolledDate} • Valid until: ${info.formattedExpiryDate} (${info.timeSpentLabel}, ${info.remainingLabel})`}
      >
        {isExpired ? (
          <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
        ) : isExpiringSoon ? (
          <Hourglass className="h-3 w-3 text-amber-400 shrink-0" />
        ) : (
          <Clock className="h-3 w-3 text-sky-400 shrink-0" />
        )}
        <span className="truncate">
          Day {info.daysEnrolled + 1} of {info.totalDays} • {info.statusBadge.label}
        </span>
      </div>
    );
  }

  // 3. Banner alert variant (e.g. at the top of Course Detail Page if expiring soon)
  if (variant === "banner") {
    if (info.isExpired) {
      return (
        <div className={`p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-start gap-3 ${className}`}>
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-rose-200">1-Month Batch Access Expired</p>
            <p className="text-xs text-rose-300/80 mt-0.5">
              Your 30-day enrollment in this batch expired on {info.formattedExpiryDate}. You were auto-unenrolled in accordance with the monthly batch cycle.
            </p>
          </div>
        </div>
      );
    }

    if (info.isExpiringSoon) {
      return (
        <div className={`p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 flex items-start gap-3 ${className}`}>
          <Hourglass className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-amber-100 flex items-center gap-2">
              Batch Expiring Soon ({info.remainingLabel})
            </p>
            <p className="text-xs text-amber-200/80 mt-0.5">
              Your 1-month batch access ends on <strong>{info.formattedExpiryDate}</strong> (auto-unenrollment policy). Please make sure to complete your remaining lectures and download your guides!
            </p>
          </div>
        </div>
      );
    }

    return null;
  }

  // 4. Card variant (rich card for Course Detail page & Drawer)
  return (
    <div
      className={`rounded-xl p-4 sm:p-5 border border-white/10 card-glass space-y-3 ${className}`}
      style={{
        background: "rgba(15, 23, 42, 0.75)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Batch Duration & Validity
          </span>
        </div>
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
            info.isExpired
              ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
              : info.isExpiringSoon
              ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
              : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
          }`}
        >
          {info.isExpired ? "Access Expired" : `${info.daysRemaining} Days Left`}
        </span>
      </div>

      {/* Main duration highlights */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
          <span className="text-[11px] text-muted-foreground block">Time in Batch</span>
          <span className="text-sm sm:text-base font-extrabold text-foreground">
            {info.daysEnrolled === 0 ? "Day 1 (Joined Today)" : `${info.daysEnrolled} Days`}
          </span>
          <span className="text-[10px] text-muted-foreground/80 block mt-0.5">
            Since {info.formattedEnrolledDate}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
          <span className="text-[11px] text-muted-foreground block">Auto-Unenroll Date</span>
          <span
            className={`text-sm sm:text-base font-extrabold ${
              info.isExpired
                ? "text-rose-400"
                : info.isExpiringSoon
                ? "text-amber-300"
                : "text-foreground"
            }`}
          >
            {info.formattedExpiryDate}
          </span>
          <span className="text-[10px] text-muted-foreground/80 block mt-0.5">
            1-Month Subscription Cycle
          </span>
        </div>
      </div>

      {/* Progress of the 30-day batch */}
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between text-xs font-medium text-muted-foreground">
          <span>Batch Timeline</span>
          <span>
            Day {info.daysEnrolled + 1} of {info.totalDays} ({info.percentTimeElapsed}% elapsed)
          </span>
        </div>
        <div className="w-full rounded-full h-2 overflow-hidden bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${info.percentTimeElapsed}%`,
              background: info.isExpired
                ? "#f43f5e"
                : info.isExpiringSoon
                ? "#f59e0b"
                : "linear-gradient(90deg, #38bdf8 0%, #818cf8 100%)",
            }}
          />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/75 leading-relaxed pt-1">
        ℹ️ Students are automatically unenrolled 30 days after joining a batch. Your access will conclude on <strong>{info.formattedExpiryDate}</strong>.
      </p>
    </div>
  );
}
