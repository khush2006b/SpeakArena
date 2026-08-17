"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeacherTransactions } from "@/hooks/queries/useTeacherQueries";
import { format } from "date-fns";

function getStatusStyle(status: string) {
  switch (status) {
    case "SUCCESS":
      return "bg-[hsla(160,84%,39%,0.15)] text-[#10b981] border border-[hsla(160,84%,39%,0.3)]";
    case "PENDING":
      return "bg-[hsla(38,92%,50%,0.15)] text-[#f59e0b] border border-[hsla(38,92%,50%,0.3)]";
    case "REFUNDED":
      return "bg-[hsla(217,91%,60%,0.15)] text-[#60a5fa] border border-[hsla(217,91%,60%,0.3)]";
    default:
      return "bg-[hsla(0,84%,60%,0.15)] text-[#ef4444] border border-[hsla(0,84%,60%,0.3)]";
  }
}

export function RecentPaymentsTable() {
  const { data, isLoading } = useTeacherTransactions({ page: 1, pageSize: 5 });
  const payments = data?.items ?? [];

  return (
    <div className="lg:col-span-2 card-glass hover-lift overflow-hidden rounded-2xl bg-card border border-border">
      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
        <div>
          <h3 className="text-lg font-extrabold text-foreground tracking-tight m-0">Recent Payments</h3>
          <p className="mt-1 text-sm text-muted-foreground m-0">
            {isLoading ? "Loading payments…" : `${data?.total ?? 0} total transactions`}
          </p>
        </div>
        <button className="btn-ghost press-scale text-sm font-semibold text-[hsl(270,80%,60%)] bg-transparent border-none cursor-pointer">
          View all
        </button>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-sm table-glass">
          <thead className="bg-muted/50">
            <tr>
              {["Student", "Course", "Amount", "Status", "Date", "Actions"].map((th, i) => (
                <th key={th} className={`p-4 sm:p-6 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground ${i === 5 ? 'text-right' : 'text-left'}`}>
                  {th}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="p-4 sm:p-6"><Skeleton className="h-4 w-32 bg-border" /></td>
                    <td className="p-4 sm:p-6"><Skeleton className="h-4 w-40 bg-border" /></td>
                    <td className="p-4 sm:p-6"><Skeleton className="h-4 w-16 bg-border" /></td>
                    <td className="p-4 sm:p-6"><Skeleton className="h-5 w-20 rounded-full bg-border" /></td>
                    <td className="p-4 sm:p-6"><Skeleton className="h-4 w-24 bg-border" /></td>
                    <td className="p-4 sm:p-6 text-right"><Skeleton className="h-6 w-6 ml-auto bg-border" /></td>
                  </tr>
                ))
              : payments.map((payment, index) => (
                  <tr
                    key={payment.id}
                    className={`border-b border-border ${index % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'} hover:bg-muted/40 transition-colors`}
                  >
                    <td className="p-4 sm:p-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">
                          {payment.studentName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {payment.studentEmail}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 sm:p-6 text-muted-foreground">
                      {payment.courseName}
                    </td>
                    <td className="p-4 sm:p-6 font-bold text-foreground">
                      {payment.currency === "USD" ? "$" : payment.currency}
                      {payment.amount.toFixed(2)}
                    </td>
                    <td className="p-4 sm:p-6">
                      <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(payment.status)}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="p-4 sm:p-6 text-muted-foreground text-[13px]">
                      {format(new Date(payment.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="p-4 sm:p-6 text-right">
                      <button className="p-2 bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer transition-colors press-scale">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
            {!isLoading && payments.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-muted-foreground text-sm">
                  No payments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
