"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { MoreHorizontal, FileText, Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiClient } from "@/services/api/client";

export default function ReportTable() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      // Use teacher analytics — payments/all is admin-only (403)
      const res = await apiClient.get("/api/v1/teacher/dashboard");
      const raw = res.data?.data ?? res.data ?? {};
      // Map recent_transactions array if available, else empty
      const txns: any[] = raw.recent_transactions ?? raw.payments ?? raw.transactions ?? [];
      setReports(txns.map((t: any) => ({
        id: t.id ?? t.payment_id ?? "-",
        studentName: t.student_name ?? t.buyer_name ?? t.student?.full_name ?? "Student",
        courseName: t.course_title ?? t.course?.title ?? t.course_name ?? "Course",
        amount: t.amount ?? t.price ?? 0,
        status: t.status ?? "completed",
        date: t.created_at ?? t.date ?? new Date().toISOString(),
      })));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="elevation-1 rounded-2xl bg-white/[0.01] mt-8 overflow-hidden transition-all duration-300 hover:elevation-2 border border-transparent hover:border-white/5">
      <div className="flex flex-row items-center justify-between p-5 border-b border-white/5">
        <div>
          <h3 className="text-lg font-extrabold tracking-tight text-foreground">Detailed Payment Reports</h3>
          <p className="text-xs font-semibold text-muted-foreground opacity-70 mt-1">Comprehensive breakdown of payments</p>
        </div>
        <Button variant="outline" size="sm" className="h-9 border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold tracking-wider press-scale">
          <Download className="mr-2 h-4 w-4" /> Export Report
        </Button>
      </div>
      <div className="p-0">
        <div className="overflow-x-auto min-h-[200px] flex flex-col relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
          ) : reports.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              No payments found.
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] font-bold tracking-widest text-muted-foreground bg-white/[0.02] uppercase border-b border-white/5">
                <tr>
                  <th scope="col" className="px-6 py-4">ID</th>
                  <th scope="col" className="px-6 py-4">Student Name</th>
                  <th scope="col" className="px-6 py-4 hidden md:table-cell">Course</th>
                  <th scope="col" className="px-6 py-4">Amount</th>
                  <th scope="col" className="px-6 py-4">Status</th>
                  <th scope="col" className="px-6 py-4 hidden sm:table-cell">Date</th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {reports.map((report) => (
                  <tr 
                    key={report.id} 
                    className="transition-colors hover:bg-white/[0.02] cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-bold tracking-tight text-foreground whitespace-nowrap">
                      {report.id}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold tracking-tight text-foreground whitespace-nowrap">{report.studentName || report.student?.name || 'Unknown'}</span>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell text-xs font-semibold text-muted-foreground truncate max-w-[200px]">
                      {report.courseName || report.course?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-extrabold text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                        ${report.amount}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-bold tracking-widest text-[9px] uppercase px-2 py-0.5",
                          report.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]" :
                          report.status === "pending" ? "bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-[0_0_10px_rgba(251,146,60,0.1)]" :
                          "bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_15px_rgba(248,113,113,0.3)] animate-pulse"
                        )}
                      >
                        {report.status || "completed"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-muted-foreground hidden sm:table-cell">
                      {new Date(report.date || report.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10 text-muted-foreground hover:text-foreground press-scale">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl">
                          <DropdownMenuItem className="font-medium cursor-pointer">
                            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                            View Full Report
                          </DropdownMenuItem>
                          <DropdownMenuItem className="font-medium cursor-pointer">
                            <Download className="mr-2 h-4 w-4 text-muted-foreground" />
                            Download PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
