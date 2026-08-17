import { create } from "zustand";

interface BillingState {
  searchQuery: string;
  activeFilter: string;
  selectedTransaction: any | null; // Changed to any to accept Payment type from API
  
  // Actions
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: string) => void;
  setSelectedTransaction: (transaction: any | null) => void;
}

export const useBillingStore = create<BillingState>((set) => ({
  searchQuery: "",
  activeFilter: "all",
  selectedTransaction: null,
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveFilter: (filter) => set({ activeFilter: filter }),
  setSelectedTransaction: (transaction) => set({ selectedTransaction: transaction }),
}));
