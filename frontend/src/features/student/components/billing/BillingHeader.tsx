"use client";

import * as React from "react";
import { Filter, Download } from "lucide-react";

export function BillingHeader() {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="page-title">Billing &amp; Purchases</h1>
        <p className="page-subtitle">Manage your course purchases, receipts, and invoices.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Filter icon button */}
        <button className="btn-ghost h-9 w-9 p-0 shrink-0 press-scale" aria-label="Filter">
          <Filter size={16} />
        </button>

        <div className="hidden sm:block h-6 w-px bg-border/60 mx-1" />

        {/* Export CSV */}
        <button className="btn-ghost h-9 hidden sm:flex press-scale">
          <Download size={16} /> Export CSV
        </button>
      </div>
    </div>
  );
}
