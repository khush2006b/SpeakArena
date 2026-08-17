"use client";

import * as React from "react";
import { BillingHeader } from "./BillingHeader";
import { PurchaseSummary } from "./PurchaseSummary";
import { PaymentHistoryTable } from "./PaymentHistoryTable";
import { TransactionDrawer } from "./TransactionDrawer";
import { BillingSupport } from "./BillingSupport";

export function BillingDashboard() {
  return (
    <div className="flex-1 w-full max-w-screen-xl mx-auto px-4 sm:px-6 pt-8 pb-20 flex flex-col bg-background animate-fade-up">

      <BillingHeader />

      <PurchaseSummary />

      <div className="mt-12 mb-6 flex items-center justify-between">
        <h3 className="text-lg font-extrabold text-foreground m-0">Payment History</h3>
      </div>

      <PaymentHistoryTable />

      <BillingSupport />

      {/* Slide-out Transaction Details Drawer */}
      <TransactionDrawer />

    </div>
  );
}
