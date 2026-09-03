"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Download, CreditCard, RefreshCcw, Loader2 } from "lucide-react";
import { useBillingStore } from "@/stores/billing.store";
import { usePaymentList } from "@/hooks/queries/usePaymentQueries";

export function PaymentHistoryTable() {
  const { setSelectedTransaction, searchQuery, activeFilter } = useBillingStore();
  const { data, isLoading } = usePaymentList({ page: 1, pageSize: 50 });
  const payments = data?.items || [];

  const filteredTransactions = React.useMemo(() => {
    let result = [...payments];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.id.toLowerCase().includes(q)
      );
    }

    if (activeFilter !== "all") {
      result = result.filter(t => t.status.toLowerCase() === activeFilter.toLowerCase());
    }

    return result;
  }, [searchQuery, activeFilter, payments]);

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status.toLowerCase()) {
      case "success":
        return <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest">Success</span>;
      case "pending":
        return <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest">Pending</span>;
      case "failed":
        return <span className="bg-destructive/15 text-destructive border border-destructive/30 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest">Failed</span>;
      case "refunded":
        return <span className="bg-muted-foreground/15 text-muted-foreground border border-muted-foreground/25 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest">Refunded</span>;
      case "processing":
        return <span className="bg-blue-400/15 text-blue-400 border border-blue-400/30 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest">Processing</span>;
      default:
        return <span className="bg-white/10 text-foreground px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest">{status}</span>;
    }
  };

  const PaymentMethod = ({ method }: { method?: any }) => {
    if (!method) {
      return <span className="text-sm font-medium text-foreground">Razorpay</span>;
    }
    if (method.type === "card") {
      return (
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground capitalize">{method.brand} •••• {method.last4}</span>
        </div>
      );
    }
    if (method.type === "paypal") {
      return (
        <div className="flex items-center gap-2">
          <RefreshCcw size={16} className="text-blue-400" />
          <span className="text-sm font-medium text-foreground">PayPal</span>
        </div>
      );
    }
    return <span className="text-sm font-medium text-foreground capitalize">{method.type}</span>;
  };

  return (
    <div className="card-glass border border-border/50 rounded-2xl overflow-hidden shadow-xl bg-card/80 backdrop-blur-xl">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-white/5 border-b border-border/60">
            <tr>
              <th className="p-4 sm:p-5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Course / Transaction ID</th>
              <th className="p-4 sm:p-5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Amount</th>
              <th className="p-4 sm:p-5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="p-4 sm:p-5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Date</th>
              <th className="p-4 sm:p-5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Payment Method</th>
              <th className="p-4 sm:p-5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground text-right">Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="h-40 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground opacity-60" />
                </td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CreditCard className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-sm font-semibold text-muted-foreground m-0">No transactions found.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredTransactions.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer hover:bg-white/[0.03] transition-colors"
                  onClick={() => setSelectedTransaction(t)}
                >
                  <td className="p-4 sm:p-5">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-foreground truncate max-w-[280px]">
                        {(t as any).course_title || (t as any).courseTitle || t.courseId || "Speak Arena Course"}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[200px]">ID: {t.id}</span>
                    </div>
                  </td>
                  <td className="p-4 sm:p-5 font-extrabold text-foreground">
                    ₹{t.amount.toLocaleString()}
                  </td>
                  <td className="p-4 sm:p-5">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="p-4 sm:p-5 text-muted-foreground text-xs font-medium">
                    {t.createdAt ? format(parseISO(t.createdAt), "MMM d, yyyy") : "N/A"}
                  </td>
                  <td className="p-4 sm:p-5">
                    <PaymentMethod method={(t as any).paymentMethod} />
                  </td>
                  <td className="p-4 sm:p-5 text-right">
                    <button
                      className="btn-ghost text-indigo-400 hover:text-indigo-300 h-8 px-3 text-xs font-semibold press-scale disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10"
                      disabled={t.status.toLowerCase() === "failed"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (t.status.toLowerCase() !== "failed") window.open("#", "_blank");
                      }}
                    >
                      <Download size={13} /> PDF
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
