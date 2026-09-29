"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  CreditCard,
  Building,
  MonitorSmartphone,
  Copy,
  ReceiptText,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFinanceStore } from "@/stores/finance.store";
import { format } from "date-fns";
import { toast } from "sonner";

export default function TransactionDrawer() {
  const { activeTransaction, setActiveTransaction } = useFinanceStore();

  if (!activeTransaction) return null;

  const symbol = activeTransaction.currency === "USD" ? "$" : "₹";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <AnimatePresence>
      {activeTransaction && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={() => setActiveTransaction(null)}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%", boxShadow: "none" }}
            animate={{ x: 0, boxShadow: "-10px 0 30px rgba(0,0,0,0.1)" }}
            exit={{ x: "100%", boxShadow: "none" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full sm:w-[500px] md:w-[600px] bg-card border-l border-border z-50 flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/50">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Transaction Details</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full press-scale" onClick={() => setActiveTransaction(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              
              {/* Massive Amount Display */}
              <div className="flex flex-col items-center justify-center py-6 bg-secondary/10 rounded-2xl border border-border/50">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment Amount</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black tracking-tighter text-foreground">
                    {symbol}{activeTransaction.amount.toLocaleString(activeTransaction.currency === "USD" ? "en-US" : "en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm font-bold text-muted-foreground ml-1.5">{activeTransaction.currency}</span>
                </div>
                <Badge variant="outline" className="mt-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1.5 py-1 px-3">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {activeTransaction.status}
                </Badge>
              </div>

              {/* Customer Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Student Customer</h3>
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card">
                  {activeTransaction.studentAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeTransaction.studentAvatar} alt={activeTransaction.studentName} className="h-12 w-12 rounded-full border border-border/50 object-cover shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
                      {activeTransaction.studentName ? activeTransaction.studentName[0] : "S"}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-foreground text-sm truncate">{activeTransaction.studentName}</span>
                    <span className="text-xs text-muted-foreground truncate">{activeTransaction.studentEmail}</span>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Information</h3>
                <div className="rounded-xl border border-border/50 bg-card overflow-hidden text-sm">
                  <div className="grid grid-cols-3 border-b border-border/50 p-4 items-center">
                    <span className="text-muted-foreground">Transaction ID</span>
                    <div className="col-span-2 flex items-center justify-between">
                      <span className="font-mono text-xs text-foreground break-all">{activeTransaction.id}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 ml-2" onClick={() => copyToClipboard(activeTransaction.id, "Transaction ID")}>
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  {activeTransaction.razorpay_payment_id && (
                    <div className="grid grid-cols-3 border-b border-border/50 p-4 items-center">
                      <span className="text-muted-foreground">Razorpay Payment ID</span>
                      <div className="col-span-2 flex items-center justify-between">
                        <span className="font-mono text-xs text-foreground break-all">{activeTransaction.razorpay_payment_id}</span>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 ml-2" onClick={() => copyToClipboard(activeTransaction.razorpay_payment_id || "", "Razorpay Payment ID")}>
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 border-b border-border/50 p-4 items-center">
                    <span className="text-muted-foreground">Date &amp; Time</span>
                    <span className="col-span-2 text-foreground text-xs font-medium">
                      {activeTransaction.date ? format(new Date(activeTransaction.date), "MMMM d, yyyy h:mm:ss a") : "—"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 p-4 items-center">
                    <span className="text-muted-foreground">Gateway Provider</span>
                    <div className="col-span-2 flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-emerald-400" />
                      <span className="text-foreground text-xs font-medium">Razorpay Payment Gateway</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Purchased Course</h3>
                <div className="rounded-xl border border-border/50 bg-card p-4 flex justify-between items-center">
                  <div className="flex flex-col min-w-0 pr-4">
                    <span className="font-semibold text-sm text-foreground truncate">{activeTransaction.courseName}</span>
                    <span className="text-xs text-muted-foreground">Full Course Lifetime Access</span>
                  </div>
                  <span className="font-bold text-foreground text-base shrink-0">
                    {symbol}{activeTransaction.amount.toLocaleString(activeTransaction.currency === "USD" ? "en-US" : "en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-border/50 bg-background/50 flex items-center gap-2">
              <Button
                variant="outline"
                className="w-full shadow-sm press-scale text-xs h-10"
                onClick={() => setActiveTransaction(null)}
              >
                Close Details
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
