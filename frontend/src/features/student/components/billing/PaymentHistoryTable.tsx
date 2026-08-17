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
    <div className="card-glass overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="table-glass">
          <thead>
            <tr>
              <th className="w-72">Course ID</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
              <th>Payment Method</th>
              <th className="text-right">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="h-32 text-center">
                  <Loader2 size={24} className="animate-spin mx-auto text-muted-foreground" />
                </td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-32 text-center text-muted-foreground">
                  No transactions found.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedTransaction(t)}
                >
                  <td>
                    <div className="flex flex-col">
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[280px]">{t.courseId}</span>
                      <span className="text-xs text-muted-foreground mt-1 font-mono">{t.id}</span>
                    </div>
                  </td>
                  <td className="font-extrabold">
                    ${(t.amount / 100).toFixed(2)}
                  </td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="text-muted-foreground">
                    {format(parseISO(t.createdAt), "MMM d, yyyy")}
                  </td>
                  <td>
                    <PaymentMethod method={(t as any).paymentMethod} />
                  </td>
                  <td className="text-right">
                    <button
                      className="btn-ghost text-primary h-8 px-3 text-sm press-scale disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={t.status.toLowerCase() === "failed"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (t.status.toLowerCase() !== "failed") window.open("#", "_blank");
                      }}
                    >
                      <Download size={14} /> PDF
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
