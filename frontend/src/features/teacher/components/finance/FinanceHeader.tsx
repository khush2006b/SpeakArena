"use client";

import * as React from "react";
import { 
  Download,
  RefreshCcw,
  DollarSign,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinanceStore } from "@/stores/finance.store";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { apiClient } from "@/services/api/client";
import { toast } from "sonner";

export function FinanceHeader() {
  const { dateRange, setDateRange, currency, setCurrency } = useFinanceStore();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.analytics.teacher() });
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Financial data refreshed");
    }, 500);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await apiClient.get("/api/v1/teacher/finance/export", {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `speakarena_finance_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Transactions exported successfully");
    } catch {
      toast.error("Failed to export transactions CSV");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl grid-bg mb-6">
      {/* Ambient glow decoration */}
      <div className="glow-purple w-64 h-64 -top-16 -right-16 opacity-60" />

      <div className="relative z-10 flex flex-col gap-4 p-4 sm:p-6 pb-5 sm:pb-7 border-b border-border/50">
        <div className="flex flex-col">
          <h1 className="text-foreground font-extrabold text-responsive-xl tracking-tight flex items-center gap-2 animate-fade-up">
            Revenue &amp; Payments
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitor verified course purchases, payments, student transactions, and cash flow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex items-center bg-card/80 border border-border/60 rounded-xl p-1 backdrop-blur-sm">
            {(["today", "week", "month", "year", "all"] as const).map((range) => {
              const isActive = dateRange === range;
              return (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-bold capitalize press-scale transition-all duration-200 ${
                    isActive
                      ? "bg-violet-600 text-white shadow-md shadow-violet-900/40"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  {range}
                </button>
              );
            })}
          </div>

          {/* Currency Filter */}
          <div className="relative">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as any)}
              className="h-9 w-32 rounded-xl border border-border/60 bg-card/80 text-foreground pl-8 pr-3 text-xs font-bold appearance-none outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition-all backdrop-blur-sm cursor-pointer"
            >
              <option value="INR" className="bg-card text-foreground">INR (₹)</option>
              <option value="USD" className="bg-card text-foreground">USD ($)</option>
              <option value="ALL" className="bg-card text-foreground">All Currencies</option>
            </select>
            <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>

          <div className="h-6 w-px bg-border/60 mx-1 hidden sm:block" />

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh Data"
            className="h-9 w-9 bg-card/80 border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl press-scale transition-all"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="btn-primary press-scale text-xs h-9 gap-1.5"
          >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
