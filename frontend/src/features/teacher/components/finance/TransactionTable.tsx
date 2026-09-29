"use client";

import * as React from "react";
import { MoreHorizontal, Receipt, CornerDownLeft, Copy, Check } from "lucide-react";
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
import { toast } from "sonner";

type Status = TeacherTransaction["status"] | string;

function getStatusBadge(status: Status) {
  const s = String(status || "").toUpperCase();
  switch (s) {
    case "SUCCESS":
    case "CAPTURED":
    case "PAID":
      return (
        <span className="inline-flex items-center rounded-lg px-2 py-1 text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          Success
        </span>
      );
    case "PENDING":
    case "CREATED":
    case "AUTHORIZED":
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
  const { setActiveTransaction, currency: storeCurrency } = useFinanceStore();

  const { data, isLoading } = useTeacherTransactions(
    { page, pageSize: 20 },
    { search, status, courseId, currency: storeCurrency } as any,
  );
  const transactions = data?.items ?? [];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="card-glass animate-fade-up mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-5 border-b border-border/50">
        <div>
          <h3 className="text-foreground font-extrabold text-base">Recent Transactions</h3>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLoading ? "Loading transactions…" : `${data?.total ?? 0} total transactions recorded`}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-b-2xl">
        <table className="table-glass w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <th className="hidden lg:table-cell py-4 px-6">Transaction ID</th>
              <th className="py-4 px-6">Student / Customer</th>
              <th className="hidden md:table-cell py-4 px-6">Course</th>
              <th className="py-4 px-6">Amount</th>
              <th className="py-4 px-6">Status</th>
              <th className="hidden sm:table-cell py-4 px-6">Date</th>
              <th className="text-right py-4 px-6">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td className="hidden lg:table-cell py-4 px-6"><Skeleton className="h-4 w-28 bg-white/5" /></td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full bg-white/5 shrink-0" />
                        <div className="flex flex-col gap-1">
                          <Skeleton className="h-4 w-24 bg-white/5" />
                          <Skeleton className="h-3 w-32 bg-white/5" />
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell py-4 px-6"><Skeleton className="h-4 w-40 bg-white/5" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-4 w-16 bg-white/5" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-20 rounded-lg bg-white/5" /></td>
                    <td className="hidden sm:table-cell py-4 px-6"><Skeleton className="h-4 w-24 bg-white/5" /></td>
                    <td className="text-right py-4 px-6"><Skeleton className="h-8 w-8 ml-auto rounded-lg bg-white/5" /></td>
                  </tr>
                ))
              : transactions.map((tx, idx) => {
                  const txCurrency = tx.currency || "INR";
                  const symbol = txCurrency === "USD" ? "$" : "₹";
                  return (
                    <tr
                      key={tx.id ? `tx-${tx.id}` : `tx-idx-${idx}`}
                      onClick={() => setActiveTransaction({
                        id: tx.id,
                        studentName: tx.studentName,
                        studentAvatar: tx.studentAvatarUrl,
                        studentEmail: tx.studentEmail,
                        courseName: tx.courseName,
                        amount: tx.amount,
                        currency: tx.currency,
                        paymentMethod: "Razorpay",
                        status: tx.status,
                        date: tx.createdAt,
                        createdAt: tx.createdAt,
                        invoiceId: tx.invoiceId,
                        last4: tx.last4,
                        razorpay_order_id: tx.razorpayOrderId,
                        razorpay_payment_id: tx.razorpayPaymentId,
                      })}
                      className="cursor-pointer hover:bg-white/[0.03] transition-colors border-b border-border/40"
                    >
                      <td className="hidden lg:table-cell font-mono text-xs text-muted-foreground py-4 px-6">
                        {tx.invoiceId || tx.id.substring(0, 16)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {tx.studentAvatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={tx.studentAvatarUrl}
                              alt={tx.studentName}
                              className="h-8 w-8 rounded-full border border-border/50 object-cover shrink-0"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold">{tx.studentName ? tx.studentName[0] : "S"}</span>
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground text-sm whitespace-nowrap truncate">{tx.studentName}</span>
                            <span className="text-xs text-muted-foreground truncate">{tx.studentEmail}</span>
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell text-muted-foreground text-sm max-w-[200px] truncate py-4 px-6">
                        {tx.courseName}
                      </td>
                      <td className="font-bold text-foreground text-sm whitespace-nowrap py-4 px-6">
                        {symbol}{tx.amount.toLocaleString(txCurrency === "USD" ? "en-US" : "en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6">{getStatusBadge(tx.status)}</td>
                      <td className="hidden sm:table-cell text-muted-foreground text-xs whitespace-nowrap py-4 px-6">
                        {tx.createdAt ? format(new Date(tx.createdAt), "MMM d, yyyy h:mm a") : "—"}
                      </td>
                      <td className="text-right py-4 px-6" onClick={(e) => e.stopPropagation()}>
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
                            className="w-52 bg-card/95 border-border backdrop-blur-xl"
                          >
                            <DropdownMenuItem
                              onClick={() =>
                                setActiveTransaction({
                                  id: tx.id,
                                  studentName: tx.studentName,
                                  studentAvatar: tx.studentAvatarUrl,
                                  studentEmail: tx.studentEmail,
                                  courseName: tx.courseName,
                                  amount: tx.amount,
                                  currency: tx.currency,
                                  paymentMethod: "Razorpay",
                                  status: tx.status,
                                  date: tx.createdAt,
                                  createdAt: tx.createdAt,
                                  invoiceId: tx.invoiceId,
                                  last4: tx.last4,
                                  razorpay_order_id: tx.razorpayOrderId,
                                  razorpay_payment_id: tx.razorpayPaymentId,
                                })
                              }
                              className="cursor-pointer"
                            >
                              <Receipt className="mr-2 h-4 w-4 text-primary" />
                              View Full Details
                            </DropdownMenuItem>
                            {tx.invoiceId && (
                              <DropdownMenuItem
                                onClick={() => copyToClipboard(tx.invoiceId || "", "Payment ID")}
                                className="cursor-pointer"
                              >
                                <Copy className="mr-2 h-4 w-4 text-muted-foreground" />
                                Copy Payment ID
                              </DropdownMenuItem>
                            )}
                            {tx.studentEmail && (
                              <DropdownMenuItem
                                onClick={() => copyToClipboard(tx.studentEmail, "Student Email")}
                                className="cursor-pointer"
                              >
                                <Copy className="mr-2 h-4 w-4 text-muted-foreground" />
                                Copy Email
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
            {!isLoading && transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground text-sm">
                  No payment transactions recorded yet.
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
