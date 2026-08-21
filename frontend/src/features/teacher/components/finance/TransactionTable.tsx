"use client";

import * as React from "react";
import { MoreHorizontal, Receipt, CornerDownLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceStore } from "@/stores/finance.store";
import { format } from "date-fns";
import { useTeacherTransactions } from "@/hooks/queries/useTeacherQueries";
import type { TeacherTransaction } from "@/services/teacher.service";

type Status = TeacherTransaction["status"];

function getStatusBadge(status: Status) {
  switch (status) {
    case "SUCCESS":
      return (
        <span className="inline-flex items-center rounded-lg px-2 py-1 text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          Success
        </span>
      );
    case "PENDING":
      return (
        <span className="inline-flex items-center rounded-lg px-2 py-1 text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          Pending
        </span>
      );
    case "FAILED":
      return (
        <span className="inline-flex items-center rounded-lg px-2 py-1 text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">
          Failed
        </span>
      );
    case "REFUNDED":
      return (
        <span className="inline-flex items-center rounded-lg px-2 py-1 text-xs font-bold bg-secondary/50 text-muted-foreground border border-border">
          Refunded
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-lg px-2 py-1 text-xs font-bold bg-card text-foreground border border-border">
          {status}
        </span>
      );
  }
}

interface TransactionTableProps {
  search?: string;
  status?: string;
  courseId?: string;
}

export default function TransactionTable({ search, status, courseId }: TransactionTableProps) {
  const [page, setPage] = React.useState(1);
  const { setActiveTransaction, currency } = useFinanceStore();
  const currencySymbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";

  const { data, isLoading } = useTeacherTransactions(
    { page, pageSize: 20 },
    { search, status, courseId } as any,
  );
  const transactions = data?.items ?? [];

  return (
    <div className="card-glass animate-fade-up mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-5 border-b border-border/50">
        <div>
          <h3 className="text-foreground font-extrabold text-base">Recent Transactions</h3>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLoading ? "Loading transactions…" : `${data?.total ?? 0} total transactions`}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-b-2xl">
        <table className="table-glass">
          <thead>
            <tr>
              <th className="hidden lg:table-cell">Transaction ID</th>
              <th>Customer</th>
              <th className="hidden md:table-cell">Product</th>
              <th>Amount</th>
              <th>Status</th>
              <th className="hidden sm:table-cell">Date</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="hidden lg:table-cell"><Skeleton className="h-4 w-32 bg-white/5" /></td>
                    <td>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full bg-white/5 shrink-0" />
                        <div className="flex flex-col gap-1">
                          <Skeleton className="h-4 w-24 bg-white/5" />
                          <Skeleton className="h-3 w-32 bg-white/5" />
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell"><Skeleton className="h-4 w-40 bg-white/5" /></td>
                    <td><Skeleton className="h-4 w-16 bg-white/5" /></td>
                    <td><Skeleton className="h-5 w-20 rounded-lg bg-white/5" /></td>
                    <td className="hidden sm:table-cell"><Skeleton className="h-4 w-24 bg-white/5" /></td>
                    <td className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-lg bg-white/5" /></td>
                  </tr>
                ))
              : transactions.map((tx, idx) => (
                  <tr
                    key={tx.id ? `tx-${tx.id}` : `tx-idx-${idx}`}
                    onClick={() => setActiveTransaction(tx as unknown as Parameters<typeof setActiveTransaction>[0])}
                    className="cursor-pointer"
                  >
                    <td className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                      {tx.id.substring(0, 16)}...
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        {tx.studentAvatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={tx.studentAvatarUrl}
                            alt={tx.studentName}
                            className="h-8 w-8 rounded-full border border-border/50 object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-foreground">{tx.studentName[0]}</span>
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-sm whitespace-nowrap">{tx.studentName}</span>
                          <span className="text-xs text-muted-foreground">{tx.studentEmail}</span>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell text-muted-foreground text-sm max-w-[200px] truncate">
                      {tx.courseName}
                    </td>
                    <td className="font-bold text-foreground text-sm whitespace-nowrap">
                      {tx.status === "REFUNDED" && (
                        <span className="text-muted-foreground line-through mr-1 text-xs">
                          {currencySymbol}{tx.amount.toFixed(2)}
                        </span>
                      )}
                      {currencySymbol}{tx.amount.toFixed(2)}
                    </td>
                    <td>{getStatusBadge(tx.status)}</td>
                    <td className="hidden sm:table-cell text-muted-foreground text-sm whitespace-nowrap">
                      {format(new Date(tx.createdAt), "MMM d, h:mm a")}
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg press-scale"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 bg-card/95 border-border backdrop-blur-xl"
                        >
                          <DropdownMenuItem
                            onClick={() =>
                              setActiveTransaction(tx as unknown as Parameters<typeof setActiveTransaction>[0])
                            }
                            className="cursor-pointer"
                          >
                            <Receipt className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/10">
                            <CornerDownLeft className="mr-2 h-4 w-4" />
                            Issue Refund
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
            {!isLoading && transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground text-sm">
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border/50">
          <span className="text-xs text-muted-foreground">{data.total} total transactions</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="bg-secondary/50 border-border text-muted-foreground hover:text-foreground rounded-lg"
            >
              Previous
            </Button>
            <span className="flex items-center px-2 text-xs text-muted-foreground">
              {page} / {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="bg-secondary/50 border-border text-muted-foreground hover:text-foreground rounded-lg"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
