"use client";

import * as React from "react";
import { Search, Filter, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useBillingStore } from "@/stores/billing.store";

export function BillingHeader() {
  const { searchQuery, setSearchQuery } = useBillingStore();

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="page-title">Billing &amp; Purchases</h1>
        <p className="page-subtitle">Manage your course purchases, receipts, and invoices.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] md:flex-none md:w-64">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-glass pl-8 h-9 text-sm"
          />
        </div>

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
