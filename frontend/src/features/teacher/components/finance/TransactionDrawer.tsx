"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  CreditCard,
  Building,
  MonitorSmartphone,
  CornerDownLeft,
  ReceiptText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFinanceStore } from "@/stores/finance.store";
import { format } from "date-fns";

export default function TransactionDrawer() {
  const { activeTransaction, setActiveTransaction, currency } = useFinanceStore();
  const currencySymbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";

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
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Massive Amount Display */}
              <div className="flex flex-col items-center justify-center py-6">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Total Amount</span>
                <div className="flex items-end gap-1">
                  <span className="text-5xl font-bold tracking-tighter text-foreground">
                    {currencySymbol}{activeTransaction.amount.toFixed(2)}
                  </span>
                  <span className="text-xl text-muted-foreground mb-1">{activeTransaction.currency}</span>
                </div>
                <Badge variant="outline" className="mt-4 bg-secondary/50">
                  {activeTransaction.status}
                </Badge>
              </div>

              {/* Customer Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Customer</h3>
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-secondary/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeTransaction.studentAvatar} alt={activeTransaction.studentName} className="h-12 w-12 rounded-full border border-border/50 object-cover" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{activeTransaction.studentName}</span>
                    <span className="text-sm text-muted-foreground">{activeTransaction.studentEmail}</span>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Payment Information</h3>
                <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                  <div className="grid grid-cols-2 border-b border-border/50 p-4">
                    <span className="text-sm text-muted-foreground">ID</span>
                    <span className="text-sm font-mono text-foreground break-all">{activeTransaction.id}</span>
                  </div>
                  <div className="grid grid-cols-2 border-b border-border/50 p-4">
                    <span className="text-sm text-muted-foreground">Date</span>
                    <span className="text-sm text-foreground">{format(new Date(activeTransaction.date), "MMMM d, yyyy h:mm a")}</span>
                  </div>
                  <div className="grid grid-cols-2 border-b border-border/50 p-4">
                    <span className="text-sm text-muted-foreground">Payment Method</span>
                    <div className="flex items-center gap-2">
                      {activeTransaction.paymentMethod === "Card" && <CreditCard className="h-4 w-4 text-muted-foreground" />}
                      {activeTransaction.paymentMethod === "PayPal" && <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />}
                      {activeTransaction.paymentMethod === "Bank Transfer" && <Building className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm text-foreground font-medium">
                        {activeTransaction.paymentMethod} {activeTransaction.last4 && `•••• ${activeTransaction.last4}`}
                      </span>
                    </div>
                  </div>
                  {activeTransaction.invoiceId && (
                    <div className="grid grid-cols-2 p-4">
                      <span className="text-sm text-muted-foreground">Invoice</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-primary cursor-pointer hover:underline">
                          {activeTransaction.invoiceId}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Product Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Line Items</h3>
                <div className="rounded-xl border border-border/50 bg-card p-4 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">{activeTransaction.courseName}</span>
                    <span className="text-xs text-muted-foreground">Qty: 1</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {currencySymbol}{activeTransaction.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-border/50 bg-background/50 flex items-center gap-2">
              <Button variant="outline" className="flex-1 shadow-sm press-scale">
                <ReceiptText className="mr-2 h-4 w-4" />
                View Invoice
              </Button>
              <Button variant="outline" className="flex-1 shadow-sm text-destructive hover:bg-destructive/10 hover:text-destructive border-transparent press-scale">
                <CornerDownLeft className="mr-2 h-4 w-4" />
                Issue Refund
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
